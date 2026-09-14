import fs from "node:fs";
import sharp from "sharp";

async function metrics(p) {
	const { data, info } = await sharp(fs.readFileSync(p))
		.ensureAlpha()
		.raw()
		.toBuffer({ resolveWithObject: true });
	const w = info.width;
	const h = info.height;
	let opaque = 0;
	let red = 0;
	let rmin = w;
	let rminY = h;
	let rmax = 0;
	let rmaxY = 0;
	for (let y = 0; y < h; y++) {
		for (let x = 0; x < w; x++) {
			const i = (y * w + x) * 4;
			if (data[i + 3] <= 16) continue;
			opaque++;
			if (data[i] > 180 && data[i + 1] < 110 && data[i + 2] < 110) {
				red++;
				if (x < rmin) rmin = x;
				if (y < rminY) rminY = y;
				if (x > rmax) rmax = x;
				if (y > rmaxY) rmaxY = y;
			}
		}
	}
	let firstDiag = null;
	for (let t = 0; t < w; t++) {
		const i = (t * w + t) * 4;
		if (data[i + 3] > 200) {
			firstDiag = t;
			break;
		}
	}
	const mid = Math.floor(w / 2);
	const ti = mid * 4;
	return {
		opaque: +(opaque / (w * h)).toFixed(3),
		glyph: +((Math.max(rmax - rmin + 1, rmaxY - rminY + 1) / w)).toFixed(3),
		firstDiag,
		topMid: [data[ti], data[ti + 1], data[ti + 2], data[ti + 3]],
	};
}

function makeSvg({ rx, pi }) {
	const { cx, cy, cw, ch, lx, ly, lw, lh, rxStem, ry, rw, rh } = pi;
	return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024" fill="none">
  <rect x="0" y="0" width="1024" height="1024" rx="${rx}" fill="#FFFFFF"/>
  <rect x="6" y="6" width="1012" height="1012" rx="${Math.max(rx - 6, 0)}" fill="none" stroke="#E7E7E7" stroke-width="10"/>
  <g fill="#FC3F1D">
    <rect x="${cx}" y="${cy}" width="${cw}" height="${ch}" rx="${Math.floor(ch / 2)}"/>
    <rect x="${lx}" y="${ly}" width="${lw}" height="${lh}" rx="${rxStem}"/>
    <rect x="${ry}" y="${ly}" width="${rw}" height="${rh}" rx="${rxStem}"/>
  </g>
</svg>`;
}

const dir = "G:/gitea/telos/.tmp-icon-compare/tune";
fs.mkdirSync(dir, { recursive: true });

const target = await metrics(
	"G:/gitea/telos/.tmp-icon-compare/live/yandex-browser/g136/256x256.png",
);
console.log("TARGET Y g136 256", target);
console.log(
	"TARGET Y g136 32",
	await metrics("G:/gitea/telos/.tmp-icon-compare/live/yandex-browser/g136/32x32.png"),
);
console.log(
	"TARGET Y g136 16",
	await metrics("G:/gitea/telos/.tmp-icon-compare/live/yandex-browser/g136/16x16.png"),
);

const piBig = {
	cx: 140,
	cy: 220,
	cw: 744,
	ch: 148,
	lx: 210,
	ly: 290,
	lw: 156,
	lh: 530,
	rxStem: 78,
	ry: 550,
	rw: 156,
	rh: 430,
};

for (const rx of [248, 256, 268, 280, 300]) {
	const svg = makeSvg({ rx, pi: piBig });
	for (const size of [16, 32, 256]) {
		const buf = await sharp(Buffer.from(svg))
			.resize(size, size, { fit: "fill", kernel: sharp.kernel.lanczos3 })
			.png()
			.toBuffer();
		const p = `${dir}/rx${rx}-${size}.png`;
		fs.writeFileSync(p, buf);
		console.log(`rx${rx}`, size, await metrics(p));
	}
}
