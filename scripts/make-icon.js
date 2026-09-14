const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');
const { Icns, IcnsImage } = require('@fiahfy/icns');

// 打包标必须是矢量 Telos 正圆白底 + π（与 LogoMark / TelosLogo / 启动画面同源）。
// 对齐本机 Yandex browser.exe 图标组 101（任务栏清晰正圆），禁止圆角方/squircle。
const svg = fs.readFileSync(path.join(__dirname, '..', 'build', 'icon.svg'), 'utf8');
const traySvgPath = path.join(__dirname, '..', 'build', 'icon-tray.svg');
const traySvg = fs.readFileSync(traySvgPath, 'utf8');
if (svg.includes('data:image/png') || traySvg.includes('data:image/png')) {
  throw new Error('build/icon.svg and icon-tray.svg must stay vector marks; do not embed a PNG');
}
if (!svg.includes('id="telos-mark"') || !svg.includes('#FC3F1D') || !svg.includes('<circle') || svg.includes('rx="268"')) {
  throw new Error('build/icon.svg must keep Yandex-g101 circle + red π (telos-mark, <circle>, #FC3F1D)');
}
if (!traySvg.includes('id="telos-tray-mark"') || !traySvg.includes('#FC3F1D') || !traySvg.includes('#F0F0F0') || !traySvg.includes('<circle')) {
  throw new Error('build/icon-tray.svg must keep white circle + red π + soft #F0 rim');
}
if (!svg.includes('#F0F0F0')) {
  throw new Error('build/icon.svg must keep soft #F0F0F0 rim (Yandex g101 style, no dark border)');
}

const out = path.join(__dirname, '..', 'build');
const iconsDir = path.join(out, 'icons');

/**
 * Windows 尺寸对齐本机 Yandex Browser 的 ICO 清单：
 *   12, 16, 20, 24, 32, 48, 64, 128, 256（全 PNG 压缩）
 * 本机实测（100% DPI）：托盘 SM_CXSMICON=16，桌面 IconSize=48，任务栏常用 24/32。
 * 另保留 40（125%×32）、512/1024 供 Linux/mac 与应用内。
 */
const winIcoSizes = [16, 20, 24, 32, 40, 48, 64, 128, 256];
const pngSizes = [12, 16, 20, 24, 32, 40, 48, 64, 128, 256, 512, 1024];
/** 通知区专用：与 Yandex 档位一致（16@100% / 20@125% / 24@150% / 32@200%）。 */
const traySizes = [16, 20, 24, 32];
const icnsSources = [
  [16, 'icp4'],
  [32, 'icp5'],
  [32, 'ic11'],
  [64, 'icp6'],
  [64, 'ic12'],
  [128, 'ic07'],
  [256, 'ic08'],
  [256, 'ic13'],
  [512, 'ic09'],
  [512, 'ic14'],
  [1024, 'ic10'],
];

/**
 * 渲染品牌 PNG（任务栏 / 安装界面 / 快捷方式 ICO）。
 * Yandex g101 正圆软边：小尺寸轻锐化，避免过锐造成假黑边。
 */
async function renderPngBuffer(size, svgSource = svg) {
  const svgBuf = Buffer.from(svgSource);
  if (size <= 32) {
    const hi = size * 4;
    const hiPng = await sharp(svgBuf)
      .resize(hi, hi, { fit: 'fill', kernel: sharp.kernel.lanczos3 })
      .png()
      .toBuffer();
    return sharp(hiPng)
      .resize(size, size, { fit: 'fill', kernel: sharp.kernel.lanczos3 })
      .sharpen({ sigma: 0.35 })
      .png({ compressionLevel: 9, adaptiveFiltering: true })
      .toBuffer();
  }
  return sharp(svgBuf)
    .resize(size, size, { fit: 'fill', kernel: sharp.kernel.lanczos3 })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();
}

/**
 * 渲染托盘 PNG：正圆白底（对齐 Yandex g101），轻锐化避免假黑边。
 */
async function renderTrayPngBuffer(size) {
  const svgBuf = Buffer.from(traySvg);
  if (size <= 32) {
    const hi = size * 4;
    const hiPng = await sharp(svgBuf)
      .resize(hi, hi, { fit: 'fill', kernel: sharp.kernel.lanczos3 })
      .png()
      .toBuffer();
    return sharp(hiPng)
      .resize(size, size, { fit: 'fill', kernel: sharp.kernel.lanczos3 })
      .sharpen({ sigma: 0.35 })
      .png({ compressionLevel: 9, adaptiveFiltering: true })
      .toBuffer();
  }
  return sharp(svgBuf)
    .resize(size, size, { fit: 'fill', kernel: sharp.kernel.lanczos3 })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();
}

async function renderPng(size, target, svgSource = svg) {
  const buf = await renderPngBuffer(size, svgSource);
  await fs.promises.writeFile(target, buf);
  return buf;
}

/**
 * 写入 PNG 压缩的 .ico（与 Yandex / Chromium 一致）。
 * png-to-ico 会把条目落成 32bpp BMP，小图标体积大且托盘/任务栏观感发软。
 */
function writePngIco(entries, target) {
  // entries: { size, png: Buffer }[]
  const count = entries.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type = icon
  header.writeUInt16LE(count, 4);

  const dir = Buffer.alloc(16 * count);
  const bodies = [];
  let offset = 6 + 16 * count;
  for (let i = 0; i < count; i++) {
    const { size, png } = entries[i];
    const w = size >= 256 ? 0 : size;
    const h = size >= 256 ? 0 : size;
    dir[i * 16] = w;
    dir[i * 16 + 1] = h;
    dir[i * 16 + 2] = 0; // color count
    dir[i * 16 + 3] = 0; // reserved
    dir.writeUInt16LE(1, i * 16 + 4); // planes
    dir.writeUInt16LE(32, i * 16 + 6); // bit count
    dir.writeUInt32LE(png.length, i * 16 + 8);
    dir.writeUInt32LE(offset, i * 16 + 12);
    bodies.push(png);
    offset += png.length;
  }
  fs.writeFileSync(target, Buffer.concat([header, dir, ...bodies]));
}

async function writeIcns(target) {
  const icns = new Icns();
  for (const [size, osType] of icnsSources) {
    const file = path.join(iconsDir, `${size}x${size}.png`);
    const buffer = await fs.promises.readFile(file);
    icns.append(IcnsImage.fromPNG(buffer, osType));
  }
  await fs.promises.writeFile(target, icns.data);

  const header = await fs.promises.readFile(target, { encoding: null });
  if (header.subarray(0, 4).toString('ascii') !== 'icns') {
    throw new Error('generated icon.icns is invalid: missing icns file header');
  }
}

async function main() {
  fs.mkdirSync(iconsDir, { recursive: true });
  fs.writeFileSync(path.join(out, 'icon.svg'), svg);
  fs.writeFileSync(traySvgPath, traySvg);

  const pngBySize = new Map();
  for (const size of pngSizes) {
    const buf = await renderPng(size, path.join(iconsDir, `${size}x${size}.png`));
    pngBySize.set(size, buf);
  }

  // 通知区：正圆白底红 π（与任务栏同一面孔；略过填仅用于小尺寸贴边）。
  for (const size of traySizes) {
    const buf = await renderTrayPngBuffer(size);
    await fs.promises.writeFile(path.join(iconsDir, `tray-${size}x${size}.png`), buf);
  }

  await fs.promises.copyFile(path.join(iconsDir, '512x512.png'), path.join(out, 'icon.png'));

  writePngIco(
    winIcoSizes.map((size) => ({ size, png: pngBySize.get(size) })),
    path.join(out, 'icon.ico'),
  );
  await writeIcns(path.join(out, 'icon.icns'));

  // 应用内侧栏/空态用同一枚正式标
  const rendererMark = path.join(__dirname, '..', 'src', 'renderer', 'src', 'assets', 'brand-mark.png');
  await sharp(Buffer.from(svg)).resize(256, 256).png().toFile(rendererMark);

  // 自检：ICO 必须全是 PNG 条目，且覆盖 Yandex 关键尺寸
  const ico = fs.readFileSync(path.join(out, 'icon.ico'));
  const count = ico.readUInt16LE(4);
  const kinds = [];
  for (let i = 0; i < count; i++) {
    const o = 6 + i * 16;
    const size = ico[o] === 0 ? 256 : ico[o];
    const bytes = ico.readUInt32LE(o + 8);
    const off = ico.readUInt32LE(o + 12);
    const isPng = ico[off] === 0x89 && ico[off + 1] === 0x50;
    kinds.push({ size, isPng, bytes });
  }
  if (kinds.some((k) => !k.isPng)) {
    throw new Error('icon.ico must embed PNG images (Yandex-style), found BMP entries');
  }
  for (const need of [16, 20, 24, 32, 48, 256]) {
    if (!kinds.some((k) => k.size === need)) {
      throw new Error(`icon.ico missing required size ${need}x${need}`);
    }
  }
  for (const size of traySizes) {
    if (!fs.existsSync(path.join(iconsDir, `tray-${size}x${size}.png`))) {
      throw new Error(`missing tray icon tray-${size}x${size}.png`);
    }
  }

  // 与 Yandex g101 / g136 对齐的不透明占比门禁（防止又缩回内接空隙圆）
  async function opaqueFillOf(file) {
    const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let opaque = 0;
    let darkRim = 0;
    const w = info.width;
    const h = info.height;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];
        if (a <= 16) continue;
        opaque += 1;
        const cx = (w - 1) / 2;
        const cy = (h - 1) / 2;
        const dist = Math.hypot(x - cx, y - cy);
        const R = Math.max(w, h) / 2;
        if (dist > R * 0.82 && r + g + b < 120 && a > 200) darkRim += 1;
      }
    }
    const mid = Math.floor(w / 2);
    const ti = mid * 4;
    return {
      opaqueFill: opaque / (w * h),
      darkRim,
      topMid: [data[ti], data[ti + 1], data[ti + 2], data[ti + 3]],
    };
  }
  const brand256 = await opaqueFillOf(path.join(iconsDir, '256x256.png'));
  const brand32 = await opaqueFillOf(path.join(iconsDir, '32x32.png'));
  const tray16 = await opaqueFillOf(path.join(iconsDir, 'tray-16x16.png'));
  // Yandex g101 正圆：256≈0.79；圆角方会到 ~0.94（任务栏会看成方）
  if (brand256.opaqueFill < 0.76 || brand256.opaqueFill > 0.86) {
    throw new Error(
      `brand 256 opaqueFill=${brand256.opaqueFill.toFixed(3)} expected ~0.79 (Yandex g101 circle)`,
    );
  }
  if (brand32.opaqueFill > 0.9) {
    throw new Error(
      `brand 32 opaqueFill=${brand32.opaqueFill.toFixed(3)} too high — looks like squircle, not circle`,
    );
  }
  if (brand256.darkRim > 0 || tray16.darkRim > 0) {
    throw new Error('icon rim must stay light; darkRim pixels found');
  }
  if (brand256.topMid[3] < 200) {
    throw new Error('brand circle must touch mid-edges (topMid alpha too low)');
  }

  console.log(
    'wrote build/icon.svg, icon-tray.svg, icon.png, icon.ico (PNG:',
    kinds.map((k) => k.size).join('/'),
    '), icon.icns, icons/*.png, icons/tray-*.png and brand-mark.png',
    `\n  brand256 opaqueFill=${brand256.opaqueFill.toFixed(3)} topMid=${brand256.topMid.join(',')}`,
    `\n  brand32 opaqueFill=${brand32.opaqueFill.toFixed(3)}`,
    `\n  tray16 opaqueFill=${tray16.opaqueFill.toFixed(3)} topMid=${tray16.topMid.join(',')}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
