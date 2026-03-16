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
} catch(e) { console.log('No kling results'); }

function run(cmd) {
  try {
    execSync(cmd, { timeout: 120000, stdio: ['pipe', 'pipe', 'pipe'] });
  } catch(e) {
    console.error('CMD FAILED:', cmd.slice(0, 300));
    if (e.stderr) console.error(e.stderr.toString().slice(-500));
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

// Use ImageMagick for text slides since ffmpeg doesn't have drawtext
function makeTextSlideIM(lines, outPath, duration) {
  // lines = [ { text, color, size } ]
  const imgPath = outPath.replace('.mp4', '.png');
  
  // Build ImageMagick command
  let args = [`convert -size 1920x1080 xc:'#0a0a1a'`];
  
  // Calculate total height for centering
  const totalH = lines.reduce((sum, l) => sum + l.size * 1.3, 0);
  let y = Math.floor((1080 - totalH) / 2) + lines[0].size;
  
  for (const line of lines) {
    const font = line.size >= 50 ? FONT_BOLD : FONT_REG;
    args.push(`-font "${font}" -pointsize ${line.size} -fill "${line.color}" -gravity North -annotate +0+${y} "${line.text}"`);
    y += Math.floor(line.size * 1.3);
  }
  
  args.push(`"${imgPath}"`);
  run(args.join(' '));
  
  // Convert to video (still image → video clip)
  run(`"${FFMPEG}" -y -loop 1 -i "${imgPath}" -vf "scale=1920:1080,format=yuv420p" -t ${duration} -c:v libx264 -pix_fmt yuv420p -r 30 "${outPath}"`);
  return outPath;
}

// Make text overlay on top of an image/video
function makeOverlaySlide(bgImgPath, outPath, duration, lines, effect='zoom_in') {
  // Create text overlay PNG with transparent bg
  const overlayPng = outPath.replace('.mp4', '_overlay.png');
  
  let args = [`convert -size 1920x1080 xc:none`];
  const totalH = lines.reduce((sum, l) => sum + l.size * 1.3, 0);
  let y = Math.floor((1080 - totalH) / 2) + lines[0].size;
  
  for (const line of lines) {
    const font = line.size >= 50 ? FONT_BOLD : FONT_REG;
    args.push(`-font "${font}" -pointsize ${line.size} -fill "${line.color}" -gravity North -annotate +0+${y} "${line.text}"`);
    y += Math.floor(line.size * 1.3);
  }
  args.push(`PNG32:"${overlayPng}"`);
  run(args.join(' '));
  
  // Create Ken Burns base
  const baseMp4 = outPath.replace('.mp4', '_base.mp4');
  makeKenBurns(bgImgPath, baseMp4, duration, effect);
  
  // Overlay text on video
  run(`"${FFMPEG}" -y -i "${baseMp4}" -i "${overlayPng}" -filter_complex "[0:v][1:v]overlay=0:0" -c:v libx264 -pix_fmt yuv420p -r 30 "${outPath}"`);
  return outPath;
}

try {
  console.log('\n=== Building Video Segments ===\n');

  const segments = [];
  let segNum = 0;
  const seg = (n) => path.join(MARKETING, `seg_${String(n).padStart(2,'0')}.mp4`);

  // --- HOOK (0-5.5s) ---
  segNum++;
  console.log(`[${segNum}] Hook: "$300 trillion market"`);
  makeTextSlideIM([
    { text: 'Real estate is a', color: 'white', size: 52 },
    { text: '$300 trillion market.', color: '#4ecdc4', size: 68 },
  ], seg(segNum), 3);
  segments.push(seg(segNum));

  segNum++;
  console.log(`[${segNum}] Hook: "still runs on spreadsheets"`);
  makeTextSlideIM([
    { text: 'It still runs on', color: 'white', size: 52 },
    { text: 'spreadsheets.', color: '#ff6b6b', size: 68 },
  ], seg(segNum), 2.5);
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
  console.log(`[${segNum}] Transition: "Meet DeedSlice" + tokenization visual (Kling)`);
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
  makeOverlaySlide(ctaBg, seg(segNum), 10.5, [
    { text: 'DeedSlice', color: 'white', size: 80 },
    { text: 'Tokenize real estate in minutes, not months.', color: '#4ecdc4', size: 34 },
    { text: 'Built on Hedera  |  deedslice.com', color: '#aaaaaa', size: 26 },
    { text: 'Try it free', color: '#4ecdc4', size: 30 },
  ], 'zoom_in');
  segments.push(seg(segNum));

  // --- Concatenate all segments ---
  console.log(`\n=== Concatenating ${segments.length} segments ===`);
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
  console.log(`   Kling clips: ${Object.values(klingResults).filter(v => v).length}`);

} catch(e) {
  console.error('Assembly error:', e.message);
  process.exit(1);
}
