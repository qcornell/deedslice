const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const FFMPEG = '/home/node/clawd/video-pipeline/node_modules/ffmpeg-static/ffmpeg';
const MARKETING = '/home/node/clawd/deedslice/marketing';
const FRAMES = '/home/node/clawd/deedslice/frames';
const DASHBOARD = '/home/node/clawd/deedslice/current dashboard ui';
const FONT_BOLD = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';
const FONT_REG = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';

// Get voiceover duration
const durOut = execSync(`"${FFMPEG}" -i "${MARKETING}/voiceover.mp3" 2>&1 || true`).toString();
const durMatch = durOut.match(/Duration: (\d+):(\d+):(\d+\.\d+)/);
const totalDur = durMatch ? parseInt(durMatch[1])*3600 + parseInt(durMatch[2])*60 + parseFloat(durMatch[3]) : 72;
console.log(`Voiceover duration: ${totalDur.toFixed(1)}s`);

// Load Kling results
let klingResults = {};
try {
  klingResults = JSON.parse(fs.readFileSync(path.join(MARKETING, 'kling_results.json'), 'utf8'));
  console.log('Kling clips available:', Object.keys(klingResults).filter(k => klingResults[k]).join(', '));
} catch(e) { console.log('No kling results, will use Ken Burns for all'); }

function run(cmd) {
  try {
    execSync(cmd, { timeout: 120000, stdio: ['pipe', 'pipe', 'pipe'] });
  } catch(e) {
    console.error('CMD FAILED:', cmd.slice(0, 200));
    if (e.stderr) console.error(e.stderr.toString().slice(-300));
    throw e;
  }
}

function kbEffect(type, duration, fps=30) {
  const d = duration * fps;
  const effects = {
    'zoom_in': `scale=8000:-1,zoompan=z='min(zoom+0.0008,1.25)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${d}:s=1920x1080:fps=${fps}`,
    'zoom_out': `scale=8000:-1,zoompan=z='if(lte(zoom,1.0),1.25,max(1.001,zoom-0.0008))':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${d}:s=1920x1080:fps=${fps}`,
    'pan_right': `scale=8000:-1,zoompan=z='1.15':x='if(lte(on,1),0,min(iw/zoom-1920,x+1.5))':y='ih/2-(ih/zoom/2)':d=${d}:s=1920x1080:fps=${fps}`,
    'pan_left': `scale=8000:-1,zoompan=z='1.15':x='if(lte(on,1),iw/zoom-1920,max(0,x-1.5))':y='ih/2-(ih/zoom/2)':d=${d}:s=1920x1080:fps=${fps}`,
  };
  return effects[type];
}

function makeKenBurns(imgPath, outPath, duration, effect='zoom_in') {
  const vf = kbEffect(effect, duration);
  run(`"${FFMPEG}" -y -loop 1 -i "${imgPath}" -vf "${vf}" -t ${duration} -c:v libx264 -pix_fmt yuv420p -r 30 "${outPath}"`);
  return outPath;
}

function makeKlingOrKenBurns(klingKey, imgPath, outPath, duration, effect='zoom_in') {
  const klingPath = klingResults[klingKey];
  if (klingPath && fs.existsSync(klingPath)) {
    const speed = 5.0 / duration;
    run(`"${FFMPEG}" -y -i "${klingPath}" -vf "setpts=${(1/speed).toFixed(4)}*PTS,scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2" -an -t ${duration} -c:v libx264 -pix_fmt yuv420p -r 30 "${outPath}"`);
    console.log(`  → Kling animated`);
    return outPath;
  }
  console.log(`  → Ken Burns fallback`);
  return makeKenBurns(imgPath, outPath, duration, effect);
}

function makeTextSlide(lines, outPath, duration, colors, sizes) {
  // Build drawtext filters for each line
  const totalHeight = sizes.reduce((s, sz) => s + sz * 1.4, 0);
  let currentY = `(h-${Math.floor(totalHeight)})/2`;
  let filters = [`color=c=0x0a0a1a:s=1920x1080:d=${duration}:r=30,format=yuv420p`];
  
  for (let i = 0; i < lines.length; i++) {
    const escaped = lines[i].replace(/:/g, '\\\\:').replace(/'/g, "\u2019");
    const color = colors[i] || 'white';
    const size = sizes[i] || 60;
    const font = size > 40 ? FONT_BOLD : FONT_REG;
    filters.push(`drawtext=text='${escaped}':fontcolor=${color}:fontsize=${size}:x=(w-text_w)/2:y=${currentY}:fontfile='${font}'`);
    currentY = `${currentY}+${Math.floor(size * 1.4)}`;
  }
  
  const vf = filters.join(',');
  run(`"${FFMPEG}" -y -f lavfi -i "color=c=0x0a0a1a:s=1920x1080:d=${duration}:r=30" -vf "${vf}" -t ${duration} -c:v libx264 -pix_fmt yuv420p -r 30 "${outPath}"`);
  return outPath;
}

try {
  console.log('\n=== Building Video Segments ===\n');

  const segments = [];
  let segNum = 0;

  // --- HOOK (0-5.5s) ---
  segNum++;
  const seg = (n) => path.join(MARKETING, `seg_${String(n).padStart(2,'0')}.mp4`);
  
  console.log(`[${segNum}] Hook: "$300 trillion market"`);
  makeTextSlide(
    ['Real estate is a', '$300 trillion market.'],
    seg(segNum), 3,
    ['white', '0x4ecdc4'],
    [52, 68]
  );
  segments.push(seg(segNum));

  segNum++;
  console.log(`[${segNum}] Hook: "still runs on spreadsheets"`);
  makeTextSlide(
    ['It still runs on', 'spreadsheets.'],
    seg(segNum), 2.5,
    ['white', '0xff6b6b'],
    [52, 68]
  );
  segments.push(seg(segNum));

  // --- PAIN POINT (5.5-16s) ---
  segNum++;
  console.log(`[${segNum}] Pain: cluttered desk (Kling)`);
  makeKlingOrKenBurns('pain_desk',
    path.join(MARKETING, 'img_pain1/001-photorealistic-overhead-shot-of-a-clutte.png'),
    seg(segNum), 5, 'zoom_in');
  segments.push(seg(segNum));

  segNum++;
  console.log(`[${segNum}] Pain: laptop spreadsheet`);
  makeKenBurns(
    path.join(MARKETING, 'img_pain2/001-photorealistic-close-up-of-a-laptop-scre.png'),
    seg(segNum), 3.5, 'pan_right');
  segments.push(seg(segNum));

  segNum++;
  console.log(`[${segNum}] Pain: frustrated invoices`);
  makeKenBurns(
    path.join(MARKETING, 'img_pain3/001-photorealistic-dramatic-shot-of-a-hand-s.png'),
    seg(segNum), 2, 'zoom_in');
  segments.push(seg(segNum));

  // --- TRANSITION (16-21s) ---
  segNum++;
  console.log(`[${segNum}] Transition: futuristic tokenization (Kling)`);
  makeKlingOrKenBurns('transition_tokens',
    path.join(MARKETING, 'img_transition/001-futuristic-clean-digital-visualization-o.png'),
    seg(segNum), 5, 'zoom_in');
  segments.push(seg(segNum));

  // --- PRODUCT SHOWCASE (21-56s) ---
  segNum++;
  console.log(`[${segNum}] Product: Dashboard overview (Kling)`);
  makeKlingOrKenBurns('dashboard_zoom',
    path.join(FRAMES, 'frame_003.jpg'),
    seg(segNum), 5, 'zoom_in');
  segments.push(seg(segNum));

  segNum++;
  console.log(`[${segNum}] Product: Tokenize form`);
  makeKenBurns(path.join(FRAMES, 'frame_013.jpg'), seg(segNum), 5, 'zoom_in');
  segments.push(seg(segNum));

  segNum++;
  console.log(`[${segNum}] Product: Deploying to Hedera`);
  makeKenBurns(path.join(FRAMES, 'frame_016.jpg'), seg(segNum), 4, 'zoom_in');
  segments.push(seg(segNum));

  segNum++;
  console.log(`[${segNum}] Product: 5 verified transactions (Kling)`);
  makeKlingOrKenBurns('verified_zoom',
    path.join(FRAMES, 'frame_018.jpg'),
    seg(segNum), 5, 'zoom_in');
  segments.push(seg(segNum));

  segNum++;
  console.log(`[${segNum}] Product: Investor management`);
  makeKenBurns(path.join(FRAMES, 'frame_022.jpg'), seg(segNum), 5, 'pan_right');
  segments.push(seg(segNum));

  segNum++;
  console.log(`[${segNum}] Product: Distributions`);
  makeKenBurns(path.join(FRAMES, 'frame_007.jpg'), seg(segNum), 5, 'zoom_in');
  segments.push(seg(segNum));

  segNum++;
  console.log(`[${segNum}] Product: Audit trail`);
  makeKenBurns(path.join(FRAMES, 'frame_023.jpg'), seg(segNum), 5, 'pan_left');
  segments.push(seg(segNum));

  // --- "No code. No lawyers." (56-62s) ---
  segNum++;
  console.log(`[${segNum}] HashScan verification`);
  makeKenBurns(path.join(FRAMES, 'frame_020.jpg'), seg(segNum), 3, 'zoom_in');
  segments.push(seg(segNum));

  segNum++;
  console.log(`[${segNum}] Properties overview`);
  makeKenBurns(path.join(DASHBOARD, 'Screenshot 2026-03-05 035651.jpg'), seg(segNum), 3, 'zoom_out');
  segments.push(seg(segNum));

  // --- CTA (62-72s) ---
  segNum++;
  console.log(`[${segNum}] CTA: DeedSlice branding`);
  const ctaBg = path.join(MARKETING, 'img_cta/001-sleek-dark-gradient-background-with-subt.png');
  const ctaBase = path.join(MARKETING, 'seg_cta_base.mp4');
  makeKenBurns(ctaBg, ctaBase, 10.5, 'zoom_in');
  // Add text overlay
  run(`"${FFMPEG}" -y -i "${ctaBase}" -vf "drawtext=text='DeedSlice':fontcolor=white:fontsize=80:x=(w-text_w)/2:y=(h/2)-100:fontfile='${FONT_BOLD}',drawtext=text='Tokenize real estate in minutes, not months.':fontcolor=0x4ecdc4:fontsize=34:x=(w-text_w)/2:y=(h/2)+10:fontfile='${FONT_REG}',drawtext=text='Built on Hedera  |  deedslice.com':fontcolor=0xaaaaaa:fontsize=26:x=(w-text_w)/2:y=(h/2)+70:fontfile='${FONT_REG}',drawtext=text='Try it free':fontcolor=0x4ecdc4:fontsize=30:x=(w-text_w)/2:y=(h/2)+130:fontfile='${FONT_BOLD}'" -c:v libx264 -pix_fmt yuv420p -r 30 "${seg(segNum)}"`);
  segments.push(seg(segNum));

  // --- Concatenate all segments ---
  console.log('\n=== Concatenating segments ===');
  const concatFile = path.join(MARKETING, 'concat.txt');
  fs.writeFileSync(concatFile, segments.map(s => `file '${s}'`).join('\n'));
  
  const rawConcat = path.join(MARKETING, 'raw_concat.mp4');
  run(`"${FFMPEG}" -y -f concat -safe 0 -i "${concatFile}" -c:v libx264 -pix_fmt yuv420p -r 30 "${rawConcat}"`);
  
  // Get raw video duration
  const rawDurOut = execSync(`"${FFMPEG}" -i "${rawConcat}" 2>&1 || true`).toString();
  const rawDurMatch = rawDurOut.match(/Duration: (\d+):(\d+):(\d+\.\d+)/);
  const rawDur = rawDurMatch ? parseInt(rawDurMatch[1])*3600 + parseInt(rawDurMatch[2])*60 + parseFloat(rawDurMatch[3]) : 0;
  console.log(`Raw video: ${rawDur.toFixed(1)}s | Voiceover: ${totalDur.toFixed(1)}s`);

  // --- Final Assembly with Voiceover ---
  console.log('\n=== Final Assembly ===');
  const finalOutput = '/home/node/clawd/deedslice/DeedSlice_Marketing_Video.mp4';
  
  run(`"${FFMPEG}" -y -i "${rawConcat}" -i "${MARKETING}/voiceover.mp3" -filter_complex "[1:a]apad[aout]" -map 0:v -map "[aout]" -c:v libx264 -preset medium -crf 18 -c:a aac -b:a 192k -shortest -pix_fmt yuv420p -movflags +faststart "${finalOutput}"`);

  const stat = fs.statSync(finalOutput);
  
  // Get final duration
  const finalDurOut = execSync(`"${FFMPEG}" -i "${finalOutput}" 2>&1 || true`).toString();
  const finalDurMatch = finalDurOut.match(/Duration: (\d+):(\d+):(\d+\.\d+)/);
  const finalDur = finalDurMatch ? parseInt(finalDurMatch[1])*3600 + parseInt(finalDurMatch[2])*60 + parseFloat(finalDurMatch[3]) : 0;
  
  console.log(`\n🎬 FINAL VIDEO COMPLETE!`);
  console.log(`   Path: ${finalOutput}`);
  console.log(`   Size: ${(stat.size / 1024 / 1024).toFixed(1)} MB`);
  console.log(`   Duration: ${finalDur.toFixed(1)}s`);
  console.log(`   Resolution: 1920x1080 @ 30fps`);
  console.log(`   Segments: ${segments.length}`);

} catch(e) {
  console.error('Assembly error:', e.message);
  process.exit(1);
}
