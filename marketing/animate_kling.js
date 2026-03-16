const jwt = require('/home/node/clawd/video-pipeline/node_modules/jsonwebtoken');
const fetch = require('/home/node/clawd/video-pipeline/node_modules/node-fetch');
const fs = require('fs');
const path = require('path');

const AK = process.env.KLING_ACCESS_KEY;
const SK = process.env.KLING_SECRET_KEY;
const MARKETING = '/home/node/clawd/deedslice/marketing';

function tok() {
  const n = Math.floor(Date.now()/1000);
  return jwt.sign({iss:AK,exp:n+1800,nbf:n-5},SK,{algorithm:'HS256'});
}

// Images to animate with Kling v2.6
const jobs = [
  {
    file: path.join(MARKETING, 'img_pain1/001-photorealistic-overhead-shot-of-a-clutte.png'),
    prompt: 'Camera slowly pushes forward over a cluttered desk covered in real estate paperwork and spreadsheets. Papers flutter slightly. Moody dramatic lighting. Smooth cinematic dolly forward.',
    label: 'pain_desk'
  },
  {
    file: path.join(MARKETING, 'img_transition/001-futuristic-clean-digital-visualization-o.png'),
    prompt: 'Camera slowly orbits around a holographic display of a building being divided into glowing digital tokens. Blockchain nodes pulse with light. Smooth cinematic rotation, futuristic atmosphere.',
    label: 'transition_tokens'
  },
  {
    file: '/home/node/clawd/deedslice/frames/frame_003.jpg',
    prompt: 'Camera slowly pushes forward toward a software dashboard screen showing real estate analytics charts and property data. Clean professional UI. Smooth subtle zoom in, like approaching a monitor.',
    label: 'dashboard_zoom'
  },
  {
    file: '/home/node/clawd/deedslice/frames/frame_018.jpg',
    prompt: 'Camera slowly zooms in on a software screen showing verified blockchain transactions with green checkmarks. Clean professional UI. Smooth cinematic zoom, slight camera drift.',
    label: 'verified_zoom'
  }
];

async function submitJob(job) {
  const imgBuf = fs.readFileSync(job.file);
  const b64 = imgBuf.toString('base64');
  
  for (let attempt = 0; attempt < 10; attempt++) {
    const resp = await fetch('https://api.klingai.com/v1/videos/image2video', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + tok(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model_name: 'kling-v2-6',
        mode: 'std',
        duration: '5',
        image: b64,
        prompt: job.prompt
      })
    });
    const data = await resp.json();
    
    if (data.code === 0 && data.data?.task_id) {
      console.log(`📤 ${job.label} submitted: ${data.data.task_id}`);
      return data.data.task_id;
    } else if (data.code === 1303) {
      console.log(`⏳ ${job.label} queue busy, waiting 30s... (attempt ${attempt+1})`);
      await new Promise(r => setTimeout(r, 30000));
    } else {
      console.error(`❌ ${job.label} error: ${JSON.stringify(data)}`);
      return null;
    }
  }
  return null;
}

async function pollTask(taskId, label) {
  const start = Date.now();
  while (Date.now() - start < 360000) {
    await new Promise(r => setTimeout(r, 10000));
    try {
      const pr = await fetch('https://api.klingai.com/v1/videos/image2video/' + taskId, {
        headers: { 'Authorization': 'Bearer ' + tok() }
      });
      const pd = await pr.json();
      if (pd.data?.task_status === 'succeed' && pd.data.task_result?.videos?.[0]?.url) {
        const url = pd.data.task_result.videos[0].url;
        const vr = await fetch(url);
        const vb = await vr.buffer();
        const outPath = path.join(MARKETING, `kling_${label}.mp4`);
        fs.writeFileSync(outPath, vb);
        const elapsed = ((Date.now() - start) / 1000).toFixed(0);
        console.log(`✅ ${label} DONE (${elapsed}s, ${(vb.length/1024).toFixed(0)} KB) → ${outPath}`);
        return outPath;
      } else if (pd.data?.task_status === 'failed') {
        console.log(`❌ ${label} FAILED: ${pd.data.task_status_msg || 'unknown'}`);
        return null;
      }
      const elapsed = ((Date.now() - start) / 1000).toFixed(0);
      process.stdout.write(`  ⏳ ${label}... ${elapsed}s\n`);
    } catch(e) { console.error(`Poll error for ${label}:`, e.message); }
  }
  console.log(`⏰ ${label} TIMEOUT`);
  return null;
}

async function main() {
  console.log('=== Kling v2.6 Animation for DeedSlice Marketing ===\n');
  
  const results = {};
  
  for (const job of jobs) {
    const taskId = await submitJob(job);
    if (taskId) {
      const clipPath = await pollTask(taskId, job.label);
      results[job.label] = clipPath;
    } else {
      results[job.label] = null;
    }
  }
  
  console.log('\n=== Results ===');
  for (const [label, p] of Object.entries(results)) {
    console.log(`${label}: ${p || 'FAILED'}`);
  }
  
  // Save results for assembly script
  fs.writeFileSync(path.join(MARKETING, 'kling_results.json'), JSON.stringify(results, null, 2));
  console.log('\nResults saved to kling_results.json');
}

main().catch(e => console.error('Fatal:', e));
