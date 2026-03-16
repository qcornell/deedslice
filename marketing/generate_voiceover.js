const fetch = require('/home/node/clawd/video-pipeline/node_modules/node-fetch');
const fs = require('fs');

const SCRIPT = `Real estate is a three hundred trillion dollar market. And it still runs on spreadsheets.

If you're a syndicator, you know the drill. Tracking investors in Excel. Chasing signatures on PDFs. Paying forty thousand dollars for a tokenization platform that takes months to set up.

There's a better way. Meet DeedSlice.

DeedSlice lets you tokenize any property in under five minutes. Enter your property details, and it auto-fills the valuation. Set your slices, hit tokenize, and watch five blockchain transactions execute in seconds. NFT deed, share tokens, audit trail — all deployed live on Hedera.

Every investor, every distribution, every transfer — tracked in real time with a tamper-proof audit trail. Generate quarterly reports with one click. Distribute returns and notify investors instantly.

No code. No lawyers. No six-figure setup fees.

DeedSlice — tokenize real estate in minutes, not months. Built on Hedera. Try it free at deedslice dot com.`;

async function main() {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) { console.error('No ELEVENLABS_API_KEY'); process.exit(1); }

  console.log('Generating voiceover with ElevenLabs Will voice...');
  console.log(`Script length: ${SCRIPT.length} chars`);

  const resp = await fetch('https://api.elevenlabs.io/v1/text-to-speech/bIHbv24MWmeRgasZH58o', {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      'Accept': 'audio/mpeg'
    },
    body: JSON.stringify({
      text: SCRIPT,
      model_id: 'eleven_multilingual_v2',
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
        style: 0.3,
        use_speaker_boost: true
      }
    })
  });

  if (!resp.ok) {
    const err = await resp.text();
    console.error(`ElevenLabs error ${resp.status}: ${err}`);
    process.exit(1);
  }

  const buffer = await resp.buffer();
  const outPath = '/home/node/clawd/deedslice/marketing/voiceover.mp3';
  fs.writeFileSync(outPath, buffer);
  console.log(`✅ Voiceover saved: ${outPath} (${(buffer.length / 1024).toFixed(0)} KB)`);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
