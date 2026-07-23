const sharp = require('sharp')
const fs = require('fs')
const path = require('path')

async function run() {
  const src = path.resolve(__dirname, '..', 'public', 'source.png')
  if (!fs.existsSync(src)) {
    console.error('Source image not found. Place your file as public/source.png')
    process.exit(1)
  }

  const out = (name) => path.resolve(__dirname, '..', 'public', name)

  try {
    await sharp(src).resize(256, 256, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } }).png().toFile(out('logo.png'))
    await sharp(src).resize(256, 256, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } }).webp({ quality: 90 }).toFile(out('logo.webp'))
    await sharp(src).resize(192, 192).png().toFile(out('icon-192.png'))
    await sharp(src).resize(512, 512).png().toFile(out('icon-512.png'))

    // Create favicon.ico from multiple sizes
    const png16 = await sharp(src).resize(16, 16).png().toBuffer()
    const png32 = await sharp(src).resize(32, 32).png().toBuffer()
    const png48 = await sharp(src).resize(48, 48).png().toBuffer()

    // Write temporary PNGs
    const tmpDir = path.resolve(__dirname, '..', 'tmp_icons')
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir)
    fs.writeFileSync(path.join(tmpDir, 'f16.png'), png16)
    fs.writeFileSync(path.join(tmpDir, 'f32.png'), png32)
    fs.writeFileSync(path.join(tmpDir, 'f48.png'), png48)

    // Use sharp to combine into ico by overlaying (sharp doesn't write ICO directly reliably),
    // but npm package 'png-to-ico' could be used. We'll try a minimal approach: use png-to-ico if available.
    try {
      const pngToIco = require('png-to-ico')
      const icoBuffer = await pngToIco([path.join(tmpDir, 'f16.png'), path.join(tmpDir, 'f32.png'), path.join(tmpDir, 'f48.png')])
      fs.writeFileSync(out('favicon.ico'), icoBuffer)
    } catch (e) {
      console.warn('png-to-ico not available — writing only 32x32 png as favicon.png')
      fs.copyFileSync(path.join(tmpDir, 'f32.png'), out('favicon.png'))
    }

    // Cleanup
    fs.rmSync(tmpDir, { recursive: true, force: true })

    console.log('Icons generated in public/: logo.png, logo.webp, icon-192.png, icon-512.png, favicon.*')
  } catch (err) {
    console.error('Error generating icons', err)
    process.exit(1)
  }
}

run()
