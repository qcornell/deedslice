const fetch = require('/home/node/clawd/video-pipeline/node_modules/node-fetch');
const fs = require('fs');

const API_KEY = process.env.ELEVENLABS_API_KEY;

// Voices to generate
const voices = {
  josh: { id: 'TxGEqnHWrfWFTfGW9XjX', desc: 'Josh - warm deep narrator' },
  will: { id: 'bIHbv24MWmeRgasZH58o', desc: 'Will - friendly warm' },
};

const script = fs.readFileSync('/home/node/clawd/deedslice/narration_script.txt', 'utf8').trim();

async function generateVoiceover(name, voiceId) {
  console.log(`\nGenerating ${name} voiceover...`);
  console.log(`Script: ${script.length} chars`);
  
  const resp = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'xi-api-key': API_KEY,
      'Content-Type': 'application/json',
      'Accept': 'audio/mpeg'
    },
    body: JSON.stringify({
      text: script,
      model_id: 'eleven_multilingual_v2',
      voice_settings: {
        stability: 0.55,        // Slightly natural variation
        similarity_boost: 0.78,  // Stay close to voice character
        style: 0.25,            // Some expressiveness but not over the top
        use_speaker_boost: true
      }
    })
  });
  
  console.log(`Status: ${resp.status}`);
  const ct = resp.headers.get('content-type');
  
  if (resp.status === 200 && ct && ct.includes('audio')) {
    const buf = await resp.buffer();
    const outPath = `/home/node/clawd/deedslice/voiceover_${name}.mp3`;
    fs.writeFileSync(outPath, buf);
    console.log(`✅ ${name}: ${(buf.length/1024).toFixed(0)}KB → ${outPath}`);
    return outPath;
  } else {
    const err = await resp.text();
    console.error(`❌ ${name}: ${err.slice(0, 300)}`);
    return null;
  }
}

async function main() {
  for (const [name, voice] of Object.entries(voices)) {
    await generateVoiceover(name, voice.id);
  }
  console.log('\nDone! Compare the two voiceovers and pick your favorite.');
}

main().catch(console.error);
