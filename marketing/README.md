# DeedSlice Marketing Video - Production Summary

## Output
- **Final Video:** `/home/node/clawd/deedslice/DeedSlice_Marketing_Video.mp4`
- **Duration:** 71.5 seconds (~1:12)
- **Resolution:** 1920x1080 @ 30fps
- **File Size:** 15.7 MB
- **Format:** H.264 + AAC, MP4 with faststart

## Voiceover
- **Voice:** Will (ElevenLabs, ID `bIHbv24MWmeRgasZH58o`)
- **Model:** eleven_multilingual_v2
- **Script:** See `script.txt` in this directory
- **Duration:** 71.9s

## Video Structure (16 segments)

| # | Time | Content | Type |
|---|------|---------|------|
| 1 | 0-3s | "Real estate is a $300 trillion market." | Text slide (ImageMagick) |
| 2 | 3-5.5s | "It still runs on spreadsheets." | Text slide (ImageMagick) |
| 3 | 5.5-10.5s | Cluttered desk with paperwork | **Kling v2.6 animated** |
| 4 | 10.5-14s | Laptop with messy spreadsheet | Ken Burns pan right |
| 5 | 14-16s | Frustrated hand on invoices | Ken Burns zoom in |
| 6 | 16-21s | Futuristic tokenization hologram | **Kling v2.6 animated** |
| 7 | 21-26s | DeedSlice dashboard overview | **Kling v2.6 animated** |
| 8 | 26-31s | Tokenize property form | Ken Burns zoom in |
| 9 | 31-35s | Deploying to Hedera mainnet | Ken Burns zoom in |
| 10 | 35-40s | 5 verified blockchain transactions | **Kling v2.6 animated** |
| 11 | 40-45s | Investor management page | Ken Burns pan right |
| 12 | 45-50s | Distribution history | Ken Burns zoom in |
| 13 | 50-55s | Audit trail | Ken Burns pan left |
| 14 | 55-58s | HashScan on-chain verification | Ken Burns zoom in |
| 15 | 58-61s | Properties overview (current UI) | Ken Burns zoom out |
| 16 | 61-71.5s | CTA: "DeedSlice - Tokenize real estate..." | Text overlay on CTA bg |

## Assets Generated

### AI Images (OpenAI gpt-image-1)
- `img_pain1/` - Cluttered office desk with real estate paperwork
- `img_pain2/` - Laptop with messy Excel spreadsheet
- `img_pain3/` - Hand on desk of invoices (frustrated energy)
- `img_transition/` - Futuristic tokenization hologram
- `img_cta/` - Dark tech background for CTA

### Kling v2.6 Animated Clips (5s each)
- `kling_pain_desk.mp4` - Camera push forward over cluttered desk
- `kling_transition_tokens.mp4` - Camera orbit around holographic tokenization
- `kling_dashboard_zoom.mp4` - Camera zoom into dashboard UI
- `kling_verified_zoom.mp4` - Camera zoom into verified transactions

### DeedSlice UI Screenshots Used
- `frame_003.jpg` - Dashboard with analytics
- `frame_007.jpg` - Distributions console
- `frame_013.jpg` - Tokenize form with auto-valuation
- `frame_016.jpg` - Deploying to Hedera progress
- `frame_018.jpg` - 5 verified blockchain transactions
- `frame_020.jpg` - HashScan NFT verification
- `frame_022.jpg` - Investor management
- `frame_023.jpg` - Audit trail
- `Screenshot 2026-03-05 035651.jpg` - Properties overview (current UI)

## Scripts
- `generate_voiceover.js` - ElevenLabs TTS generation
- `animate_kling.js` - Kling v2.6 image-to-video pipeline
- `assemble_v2.js` - Final ffmpeg assembly (Ken Burns + Kling + text)

## Notes
- ffmpeg's drawtext filter was unavailable in the static build, so ImageMagick was used for text slides
- 4 of 16 segments use Kling v2.6 animation for dynamic camera movement
- Ken Burns effects (zoom/pan) used for remaining segments to keep visual interest
- Voiceover closely matches video timing (~71.5s video vs 71.9s audio)
