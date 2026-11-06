// .docx（zip）から特定のファイルを取り出す最小限の zip リーダー（外部ライブラリなし）
const zlib = require('node:zlib');

/** @param {Buffer} buf @returns {Map<string, Buffer>} 名前 → 中身 */
function readZip(buf) {
  // 終端レコード（End of Central Directory）を後ろから探す
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('zip 形式ではありません（.docx ではない可能性があります）');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const out = new Map();
  for (let k = 0; k < count; k++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('zip の目次が壊れています');
    const method = buf.readUInt16LE(p + 10);
    const csize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    const lNameLen = buf.readUInt16LE(local + 26);
    const lExtraLen = buf.readUInt16LE(local + 28);
    const start = local + 30 + lNameLen + lExtraLen;
    const data = buf.subarray(start, start + csize);
    if (method === 0) out.set(name, data);
    else if (method === 8) out.set(name, zlib.inflateRawSync(data));
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

/** .docx の本文 XML（word/document.xml）を文字列で返す */
function readDocxXml(buf) {
  const files = readZip(buf);
  const doc = files.get('word/document.xml');
  if (!doc) throw new Error('Word 文書（word/document.xml）が見つかりません');
  return doc.toString('utf8');
}

module.exports = { readZip, readDocxXml };
