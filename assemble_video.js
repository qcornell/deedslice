const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const FFMPEG = '/home/node/clawd/video-pipeline/node_modules/ffmpeg-static/ffmpeg';
const BASE = '/home/node/clawd/deedslice';

const VIDEO = path.join(BASE, 'DeedSlice Demo.mp4');
const VOICE_JOSH = path.join(BASE, 'voiceover_josh.mp3');
const VOICE_WILL = path.join(BASE, 'voiceover_will.mp3');

// Output files
const OUT_JOSH = path.join(BASE, 'DeedSlice_Demo_Josh.mp4');
const OUT_WILL = path.join(BASE, 'DeedSlice_Demo_Will.mp4');

function assembleVideo(voicePath, outputPath, voiceName) {
  console.log(`\n🎬 Assembling with ${voiceName}...`);
  
  // Strategy:
  // 1. Replace original silent audio with voiceover
  // 2. Add a 1-second fade-in on voice
  // 3. Let voice play naturally, video continues after voice ends
  // 4. Add fade-out on last 2 seconds of voice
  
  // Get voice duration
  const probeCmd = `${FFMPEG} -i "${voicePath}" 2>&1 | grep Duration`;
  const probeOut = execSync(probeCmd, { encoding: 'utf8' });
  const durMatch = probeOut.match(/Duration: (\d+):(\d+):(\d+\.\d+)/);
  const voiceDur = durMatch ? parseInt(durMatch[1])*3600 + parseInt(durMatch[2])*60 + parseFloat(durMatch[3]) : 0;
  console.log(`Voice duration: ${voiceDur.toFixed(1)}s`);
  
  // Simple mix: replace audio track with voiceover
  // -map 0:v takes video from input 0 (original video)
  // -map 1:a takes audio from input 1 (voiceover)
  // -shortest would cut video to voice length, but we want full video
  // Instead: pad the voice with silence to match video length
  const cmd = [
    `"${FFMPEG}" -y`,
    `-i "${VIDEO}"`,           // input 0: original video
    `-i "${voicePath}"`,       // input 1: voiceover
    `-filter_complex`,
    // Pad voiceover with silence to match video duration, add gentle fade in/out
    `"[1:a]afade=t=in:st=0:d=0.5,afade=t=out:st=${(voiceDur - 2).toFixed(1)}:d=2,apad=pad_dur=300[voice]"`,
    `-map 0:v`,                // use original video
    `-map "[voice]"`,          // use processed voiceover
    `-c:v copy`,               // don't re-encode video
    `-c:a aac -b:a 192k`,     // encode audio as AAC
    `-shortest`,               // stop at end of video
    `"${outputPath}"`
  ].join(' ');
  
  console.log('Running ffmpeg...');
  try {
    execSync(cmd, { encoding: 'utf8', stdio: 'pipe' });
    const size = fs.statSync(outputPath).size;
    console.log(`✅ ${voiceName}: ${(size/1024/1024).toFixed(1)}MB → ${outputPath}`);
  } catch(e) {
    console.error(`❌ ${voiceName} failed:`, e.stderr?.slice(-500) || e.message);
  }
}

// Assemble both versions
assembleVideo(VOICE_JOSH, OUT_JOSH, 'Josh');
assembleVideo(VOICE_WILL, OUT_WILL, 'Will');

console.log('\n🎉 Done! Two versions ready:');
console.log(`  Josh: ${OUT_JOSH}`);
console.log(`  Will: ${OUT_WILL}`);
