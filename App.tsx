
import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { 
  CloudArrowUpIcon, 
  TrashIcon, 
  PlayIcon, 
  PauseIcon, 
  ArrowDownTrayIcon,
  AdjustmentsHorizontalIcon,
  QueueListIcon,
  SparklesIcon,
  ExclamationCircleIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';
import { FrameData, SVGAConfig, GenerationStatus } from './types';

const naturalSort = (a: string, b: string) => {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
};

const App: React.FC = () => {
  const [frames, setFrames] = useState<FrameData[]>([]);
  const [dimensions, setDimensions] = useState<{width: number, height: number}>({ width: 0, height: 0 });
  const [config, setConfig] = useState<SVGAConfig>({
    fps: 24,
    duration: 2,
    loop: true
  });
  const [status, setStatus] = useState<GenerationStatus>({
    progress: 0,
    message: '',
    isGenerating: false
  });
  const [previewIndex, setPreviewIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  
  const playRef = useRef<number | null>(null);

  const getImageDimensions = (file: File): Promise<{width: number, height: number}> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const d = { width: img.width, height: img.height };
        URL.revokeObjectURL(img.src);
        resolve(d);
      };
      img.src = URL.createObjectURL(file);
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    if (files.length === 0) return;

    if (dimensions.width === 0) {
      const d = await getImageDimensions(files[0]);
      setDimensions(d);
    }

    const newFrames: FrameData[] = files.map((file, idx) => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      previewUrl: URL.createObjectURL(file),
      name: file.name,
      index: idx
    }));

    const sortedFrames = [...frames, ...newFrames].sort((a, b) => naturalSort(a.name, b.name));
    setFrames(sortedFrames);
  };

  const removeFrame = (id: string) => {
    setFrames(prev => {
      const filtered = prev.filter(f => f.id !== id);
      if (filtered.length === 0) setDimensions({ width: 0, height: 0 });
      return filtered;
    });
  };

  const clearAll = () => {
    frames.forEach(f => URL.revokeObjectURL(f.previewUrl));
    setFrames([]);
    setDimensions({ width: 0, height: 0 });
    setIsPlaying(false);
  };

  // Simulated image loop preview
  useEffect(() => {
    if (isPlaying && frames.length > 0) {
      const interval = 1000 / config.fps;
      playRef.current = window.setInterval(() => {
        setPreviewIndex(prev => (prev + 1) % frames.length);
      }, interval);
    } else {
      if (playRef.current) clearInterval(playRef.current);
    }
    return () => {
      if (playRef.current) clearInterval(playRef.current);
    };
  }, [isPlaying, frames.length, config.fps]);

  const calculatedDuration = useMemo(() => {
    if (frames.length === 0) return 0;
    return parseFloat((frames.length / config.fps).toFixed(2));
  }, [frames.length, config.fps]);

  const generateAndDownloadSVGA = async () => {
    if (frames.length === 0) return;
    
    setStatus({ isGenerating: true, progress: 10, message: '正在打包 SVGA 2.0 资源...' });

    try {
      // @ts-ignore
      const zip = new JSZip();
      
      const movieSpec = {
        version: "2.0",
        params: {
          viewBox: { 
            width: dimensions.width, 
            height: dimensions.height 
          },
          fps: config.fps,
          frames: frames.length
        },
        images: {} as Record<string, string>,
        sprites: [
          {
            imageKey: null,
            frames: frames.map((_, i) => ({
              alpha: 1,
              transform: { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 },
              imageKey: `img_${i}`,
              layout: { x: 0, y: 0, width: dimensions.width, height: dimensions.height }
            }))
          }
        ]
      };

      const imagesFolder = zip.folder("images");
      for (let i = 0; i < frames.length; i++) {
        const frame = frames[i];
        const key = `img_${i}`;
        const filename = `${key}.png`;
        movieSpec.images[key] = filename;
        const buffer = await frame.file.arrayBuffer();
        imagesFolder.file(filename, buffer);
        
        setStatus(prev => ({ 
          ...prev, 
          progress: 10 + Math.floor((i / frames.length) * 85), 
          message: `正在封装帧资源: ${i + 1}/${frames.length}` 
        }));
      }

      zip.file("movie.spec", JSON.stringify(movieSpec));
      
      const content = await zip.generateAsync({ 
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: { level: 6 }
      });

      const url = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = `animation_${dimensions.width}x${dimensions.height}_${Date.now()}.svga`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setStatus({ isGenerating: false, progress: 100, message: '合成并导出成功！' });
      setTimeout(() => setStatus(prev => ({ ...prev, progress: 0, message: '' })), 2000);
    } catch (error) {
      console.error(error);
      setStatus({ isGenerating: false, progress: 0, message: '合成失败' });
      alert("合成失败，请检查素材文件是否正确。");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20 selection:bg-indigo-100">
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50 px-6 py-4 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-2 rounded-xl text-white shadow-lg shadow-indigo-200">
            <QueueListIcon className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-black bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent uppercase tracking-tight">
            SVGA 序列帧合成
          </h1>
        </div>
        <button 
          onClick={clearAll}
          className="px-4 py-2 text-slate-400 hover:text-red-500 text-xs font-black uppercase transition-colors"
        >
          重置画布
        </button>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10 grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-7 flex flex-col gap-8">
          <div 
            className="relative group border-2 border-dashed border-slate-200 hover:border-indigo-400 bg-white rounded-[2.5rem] p-12 transition-all flex flex-col items-center justify-center cursor-pointer shadow-sm hover:shadow-md"
            onClick={() => document.getElementById('file-upload')?.click()}
          >
            <input type="file" id="file-upload" multiple accept="image/*" className="hidden" onChange={handleFileUpload} />
            <div className="bg-indigo-50 p-6 rounded-[2rem] mb-6 group-hover:scale-110 transition-transform duration-500">
              <CloudArrowUpIcon className="w-10 h-10 text-indigo-600" />
            </div>
            <p className="text-xl font-black text-slate-800 uppercase tracking-tighter">上传序列图集</p>
            <p className="text-[11px] text-slate-400 mt-3 font-bold tracking-widest uppercase">支持 PNG / JPG • 自动自然排序</p>
          </div>

          <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-200 overflow-hidden flex flex-col flex-1 min-h-[500px]">
            <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/40">
              <span className="text-xs font-black text-slate-700 uppercase tracking-widest">序列帧管理 ({frames.length})</span>
              <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 bg-white border border-slate-200 px-4 py-1.5 rounded-full shadow-sm">
                <ArrowPathIcon className="w-3.5 h-3.5 text-indigo-500" />
                文件名排序
              </div>
            </div>
            <div className="p-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-5 overflow-y-auto custom-scrollbar max-h-[600px]">
              {frames.map((frame, idx) => (
                <div key={frame.id} className="group relative aspect-square bg-slate-50 rounded-3xl overflow-hidden border border-slate-200 hover:border-indigo-400 transition-all duration-300">
                  <img src={frame.previewUrl} alt={frame.name} className="w-full h-full object-contain p-2" />
                  <div className="absolute top-3 left-3 bg-indigo-600/90 text-white text-[10px] font-black px-2.5 py-1 rounded-xl">
                    {idx + 1}
                  </div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); removeFrame(frame.id); }}
                    className="absolute top-3 right-3 p-2 bg-red-500 text-white rounded-xl opacity-0 group-hover:opacity-100 transition-all shadow-xl"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {frames.length === 0 && (
                <div className="col-span-full h-80 flex flex-col items-center justify-center text-slate-200">
                  <QueueListIcon className="w-20 h-20 opacity-10 mb-6" />
                  <p className="font-black text-xs uppercase tracking-[0.3em] opacity-30">等待上传素材...</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 flex flex-col gap-8">
          <div className="bg-slate-950 rounded-[3.5rem] shadow-2xl overflow-hidden aspect-square relative group border-[14px] border-white ring-1 ring-slate-200">
            <div className="absolute top-8 left-8 z-20 flex gap-3">
                <div className="bg-black/60 text-white text-[9px] px-4 py-2 rounded-full backdrop-blur-xl border border-white/10 flex items-center gap-2.5 font-black uppercase tracking-widest pointer-events-none">
                    <span className={`w-3 h-3 rounded-full ${isPlaying ? 'bg-indigo-500 shadow-[0_0_15px_rgba(99,102,241,1)]' : 'bg-slate-500'}`}></span>
                    预览模式
                </div>
                {dimensions.width > 0 && (
                    <div className="bg-indigo-600 text-white text-[10px] px-4 py-2 rounded-full font-mono font-black shadow-2xl">
                        {dimensions.width}x{dimensions.height}
                    </div>
                )}
            </div>
            
            <div className="w-full h-full flex items-center justify-center bg-black">
                {frames.length > 0 ? (
                    <img 
                      src={frames[previewIndex]?.previewUrl} 
                      className="max-w-[90%] max-h-[90%] object-contain"
                      alt="预览"
                    />
                ) : (
                    <PlayIcon className="w-32 h-32 text-slate-800/20" />
                )}
            </div>

            <div className="absolute bottom-0 left-0 right-0 p-10 bg-gradient-to-t from-black via-black/40 to-transparent flex items-end justify-between">
              <button 
                onClick={() => setIsPlaying(!isPlaying)}
                className="w-20 h-20 flex items-center justify-center bg-white text-slate-950 rounded-[2rem] hover:scale-110 active:scale-90 transition-all shadow-2xl"
              >
                {isPlaying ? <PauseIcon className="w-10 h-10" /> : <PlayIcon className="w-10 h-10 ml-1.5" />}
              </button>
              <div className="text-right">
                <div className="text-[10px] font-black text-indigo-400 mb-2 uppercase tracking-widest opacity-80">播放状态</div>
                <div className="text-4xl font-mono font-black text-white tracking-tighter leading-none">
                  {frames.length > 0 ? (previewIndex + 1).toString().padStart(2, '0') : '--'}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-[3rem] shadow-sm border border-slate-200 p-10 flex flex-col gap-10">
            <div className="flex items-center gap-4 pb-6 border-b border-slate-100">
               <div className="p-2.5 bg-indigo-50 rounded-2xl">
                  <AdjustmentsHorizontalIcon className="w-6 h-6 text-indigo-600" />
               </div>
               <h2 className="font-black text-slate-800 uppercase text-xs tracking-[0.2em]">输出参数</h2>
            </div>

            <div className="space-y-8">
              <div className="space-y-5">
                <div className="flex justify-between items-end">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">播放帧率 (FPS)</label>
                  <span className="px-4 py-1.5 bg-indigo-600 text-white rounded-2xl font-mono font-black text-sm shadow-xl shadow-indigo-200">{config.fps} FPS</span>
                </div>
                <input 
                  type="range" min="1" max="60" value={config.fps} 
                  onChange={(e) => setConfig(prev => ({ ...prev, fps: parseInt(e.target.value) }))}
                  className="w-full h-2.5 bg-slate-100 rounded-full appearance-none cursor-pointer accent-indigo-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-6">
                  <div className="bg-slate-50/80 p-6 rounded-[2rem] border border-slate-100">
                      <div className="text-[9px] font-black text-slate-400 uppercase mb-2">总计帧数</div>
                      <div className="text-3xl font-mono font-black text-slate-800 leading-none">{frames.length}</div>
                  </div>
                  <div className="bg-slate-50/80 p-6 rounded-[2rem] border border-slate-100">
                      <div className="text-[9px] font-black text-slate-400 uppercase mb-2">动画时长</div>
                      <div className="text-3xl font-mono font-black text-indigo-600 leading-none">{calculatedDuration}s</div>
                  </div>
              </div>
            </div>

            <button 
              onClick={generateAndDownloadSVGA}
              disabled={frames.length === 0 || status.isGenerating}
              className={`w-full py-7 rounded-[2.5rem] flex flex-col items-center justify-center transition-all shadow-2xl active:scale-95 group ${
                frames.length === 0
                ? 'bg-slate-100 text-slate-300 cursor-not-allowed shadow-none' 
                : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-500/30'
              }`}
            >
              {status.isGenerating ? (
                <div className="flex items-center gap-4">
                    <ArrowPathIcon className="w-7 h-7 animate-spin text-white/50" />
                    <span className="font-black uppercase tracking-widest text-xl">{status.progress}% 处理中</span>
                </div>
              ) : (
                <>
                    <div className="flex items-center gap-3 mb-1">
                        <SparklesIcon className="w-7 h-7 text-amber-300" />
                        <span className="text-2xl font-black uppercase tracking-[0.1em] text-white">合成并导出</span>
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] opacity-50">生成并下载 SVGA 文件</span>
                </>
              )}
            </button>
          </div>

          <div className="p-6 bg-slate-900 text-white rounded-[2.5rem] shadow-sm">
              <h4 className="text-[10px] font-black text-indigo-400 uppercase mb-3 tracking-[0.2em]">
                  SVGA 2.0 封装说明
              </h4>
              <p className="text-[11px] text-slate-400 font-bold leading-relaxed">
                  本工具将序列图集直接打包为符合 SVGA 2.0 规范的 ZIP 容器。适用于所有支持 SVGA 播放器的移动端与 Web 平台。
              </p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
