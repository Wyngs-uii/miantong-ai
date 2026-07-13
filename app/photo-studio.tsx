"use client";
/* Local data URLs need native img elements for immediate, private preview. */
/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState } from "react";

type BackgroundColor = "white" | "blue";

const BACKGROUNDS: Record<BackgroundColor, { label: string; value: string }> = {
  white: { label: "白色", value: "#ffffff" },
  blue: { label: "蓝色", value: "#438edb" },
};

const WASM_ROOT = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm";
const MODEL_URL = "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/1/selfie_multiclass_256x256.tflite";

function loadImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("照片读取失败"));
    image.src = source;
  });
}

function readFile(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("照片读取失败"));
    reader.readAsDataURL(file);
  });
}

export default function PhotoStudio({ onClose, onApply }: { onClose: () => void; onApply: (dataUrl: string) => void }) {
  const [source, setSource] = useState("");
  const [foreground, setForeground] = useState("");
  const [result, setResult] = useState("");
  const [background, setBackground] = useState<BackgroundColor>("white");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("选择一张正面、光线均匀的日常照片开始制作。");
  const segmenterRef = useRef<import("@mediapipe/tasks-vision").ImageSegmenter | null>(null);

  useEffect(() => () => segmenterRef.current?.close(), []);

  async function compose(foregroundUrl: string, color: BackgroundColor) {
    const person = await loadImage(foregroundUrl);
    const canvas = document.createElement("canvas");
    canvas.width = 600;
    canvas.height = 800;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("当前浏览器无法处理图片");
    context.fillStyle = BACKGROUNDS[color].value;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(person, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    setResult(dataUrl);
    return dataUrl;
  }

  async function makePortrait(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/")) return setStatus("请选择 JPG、PNG 或 WebP 图片。");
    if (file.size > 8 * 1024 * 1024) return setStatus("原始照片请控制在 8MB 以内。");
    setBusy(true);
    setStatus("正在识别人像并移除背景，首次使用可能需要十几秒……");
    try {
      const sourceUrl = await readFile(file);
      setSource(sourceUrl);
      const image = await loadImage(sourceUrl);
      const workCanvas = document.createElement("canvas");
      workCanvas.width = 600;
      workCanvas.height = 800;
      const work = workCanvas.getContext("2d");
      if (!work) throw new Error("当前浏览器无法处理图片");
      const scale = Math.max(workCanvas.width / image.naturalWidth, workCanvas.height / image.naturalHeight);
      const width = image.naturalWidth * scale;
      const height = image.naturalHeight * scale;
      work.drawImage(image, (workCanvas.width - width) / 2, (workCanvas.height - height) / 2, width, height);

      if (!segmenterRef.current) {
        const { FilesetResolver, ImageSegmenter } = await import("@mediapipe/tasks-vision");
        const vision = await FilesetResolver.forVisionTasks(WASM_ROOT);
        segmenterRef.current = await ImageSegmenter.createFromOptions(vision, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: "CPU" },
          runningMode: "IMAGE",
          outputConfidenceMasks: false,
          outputCategoryMask: true,
        });
      }

      const segmentation = segmenterRef.current.segment(workCanvas);
      const categoryMask = segmentation.categoryMask;
      if (!categoryMask) throw new Error("没有识别到清晰人像，请换一张正面照片重试");
      const categories = categoryMask.getAsUint8Array();
      const maskCanvas = document.createElement("canvas");
      maskCanvas.width = categoryMask.width;
      maskCanvas.height = categoryMask.height;
      const maskContext = maskCanvas.getContext("2d");
      if (!maskContext) throw new Error("当前浏览器无法处理图片");
      const maskImage = maskContext.createImageData(maskCanvas.width, maskCanvas.height);
      for (let index = 0; index < categories.length; index += 1) {
        const alpha = categories[index] === 0 ? 0 : 255;
        const offset = index * 4;
        maskImage.data[offset] = 255;
        maskImage.data[offset + 1] = 255;
        maskImage.data[offset + 2] = 255;
        maskImage.data[offset + 3] = alpha;
      }
      maskContext.putImageData(maskImage, 0, 0);

      const personCanvas = document.createElement("canvas");
      personCanvas.width = 600;
      personCanvas.height = 800;
      const personContext = personCanvas.getContext("2d");
      if (!personContext) throw new Error("当前浏览器无法处理图片");
      personContext.drawImage(workCanvas, 0, 0);
      personContext.globalCompositeOperation = "destination-in";
      personContext.imageSmoothingEnabled = true;
      personContext.drawImage(maskCanvas, 0, 0, personCanvas.width, personCanvas.height);
      const foregroundUrl = personCanvas.toDataURL("image/png");
      setForeground(foregroundUrl);
      await compose(foregroundUrl, background);
      categoryMask.close();
      setStatus("证件照已生成，可以切换底色后使用。");
    } catch (error) {
      setForeground("");
      setResult("");
      setStatus(error instanceof Error ? error.message : "证件照生成失败，请重试。");
    } finally {
      setBusy(false);
    }
  }

  async function chooseBackground(color: BackgroundColor) {
    setBackground(color);
    if (foreground) {
      setBusy(true);
      try { await compose(foreground, color); } finally { setBusy(false); }
    }
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="photo-studio-modal" role="dialog" aria-modal="true" aria-labelledby="photo-studio-title">
        <button className="modal-close" onClick={onClose} aria-label="关闭 AI 证件照">×</button>
        <span className="studio-kicker">面通 AI 工作室</span>
        <h2 id="photo-studio-title">AI 证件照</h2>
        <p className="studio-intro">上传普通正面照片，自动抠出人物并生成简历常用的白底或蓝底证件照。</p>

        <div className="studio-previews">
          <figure><div>{source ? <img src={source} alt="原始照片" /> : <span>上传日常照片</span>}</div><figcaption>原图</figcaption></figure>
          <figure><div className={busy ? "is-processing" : ""}>{result ? <img src={result} alt="AI 证件照效果" /> : <span>{busy ? "AI 处理中…" : "等待生成"}</span>}</div><figcaption>证件照预览</figcaption></figure>
        </div>

        <div className="studio-controls">
          <label className="studio-upload">选择日常照片<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => makePortrait(event.target.files?.[0])} /></label>
          <fieldset className="background-picker"><legend>选择底色</legend>{(Object.keys(BACKGROUNDS) as BackgroundColor[]).map((color) => (
            <button key={color} className={background === color ? "active" : ""} onClick={() => chooseBackground(color)} disabled={!foreground || busy}>
              <i style={{ background: BACKGROUNDS[color].value }} />{BACKGROUNDS[color].label}
            </button>
          ))}</fieldset>
        </div>
        <p className="studio-status" aria-live="polite">{status}</p>
        <div className="studio-footer"><small>照片仅在当前设备处理，不会上传到模型服务。</small><button className="primary-button" disabled={!result || busy} onClick={() => onApply(result)}>使用这张证件照</button></div>
      </section>
    </div>
  );
}
