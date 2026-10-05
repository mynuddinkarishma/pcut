import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Upload, Download, Printer, Move, ZoomIn, Image as ImageIcon, 
  CheckCircle2, RotateCw, Sun, SlidersHorizontal, 
  LayoutGrid, Settings2, AlertTriangle, Wifi, Bluetooth, Loader2, X, ChevronDown,
  Square, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Crop
} from 'lucide-react';

const DPI = 300;
const INCH_TO_MM = 25.4;

const COUNTRIES = [
  { id: 'india', name: 'India (3.5 x 4.5 cm)', widthMm: 35, heightMm: 45, widthPx: 413, heightPx: 531 },
  { id: 'usa', name: 'USA (2 x 2 inch)', widthMm: 51, heightMm: 51, widthPx: 600, heightPx: 600 },
  { id: 'uk', name: 'UK (3.5 x 4.5 cm)', widthMm: 35, heightMm: 45, widthPx: 413, heightPx: 531 },
  { id: 'europe', name: 'Europe (3.5 x 4.5 cm)', widthMm: 35, heightMm: 45, widthPx: 413, heightPx: 531 },
  { id: 'australia', name: 'Australia (3.5 x 4.5 cm)', widthMm: 35, heightMm: 45, widthPx: 413, heightPx: 531 },
];

const SHEET_SIZES = [
  { id: '4x6', name: '4 x 6 inch', widthPx: 1800, heightPx: 1200 }, 
];

const MOCK_PRINTERS = [
  'HP LaserJet Pro Network',
  'Canon PIXMA Wireless',
  'Epson EcoTank Wi-Fi',
  'Brother HL-L2350DW'
];

export default function PassportPhotoMaker() {
  const [image, setImage] = useState(null);
  const [country, setCountry] = useState(COUNTRIES[0]);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [generatedSheet, setGeneratedSheet] = useState(null);
  const [showAdjustments, setShowAdjustments] = useState(false);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturation, setSaturation] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [layoutMode, setLayoutMode] = useState('auto');
  const [gapMm, setGapMm] = useState(2);
  const [manualRows, setManualRows] = useState(2);
  const [manualCols, setManualCols] = useState(3);
  const [layoutWarning, setLayoutWarning] = useState(null);
  const [showBorder, setShowBorder] = useState(true);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('idle');
  const [connectionType, setConnectionType] = useState(null);
  const [selectedPrinter, setSelectedPrinter] = useState(null);

  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);

  const displayWidth = 320; 
  const displayHeight = (country.heightPx / country.widthPx) * displayWidth;

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new window.Image();
        img.onload = () => {
          setImage(img);
          setScale(1);
          setPosition({ x: 0, y: 0 });
          setBrightness(100);
          setContrast(100);
          setSaturation(100);
          setRotation(0);
          setGeneratedSheet(null);
          setLayoutWarning(null);
          setShowAdjustments(false);
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    }
  };

  const clampPosition = useCallback((x, y, targetScale = scale, targetRotation = rotation, targetCountry = country) => {
    if (!image) return { x, y };
    
    const cHeight = (targetCountry.heightPx / targetCountry.widthPx) * displayWidth;
    const isRotated90 = targetRotation % 180 !== 0;
    const imgW = isRotated90 ? image.height : image.width;
    const imgH = isRotated90 ? image.width : image.height;
    
    const imgAspect = imgW / imgH;
    const canvasAspect = displayWidth / cHeight;
    let baseScale = 1;
    
    if (imgAspect > canvasAspect) {
      baseScale = cHeight / imgH;
    } else {
      baseScale = displayWidth / imgW;
    }
    
    const finalScale = baseScale * targetScale;
    
    const maxX = Math.max(0, (imgW * finalScale - displayWidth) / 2);
    const maxY = Math.max(0, (imgH * finalScale - cHeight) / 2);
    
    return {
      x: Math.min(Math.max(x, -maxX), maxX),
      y: Math.min(Math.max(y, -maxY), maxY)
    };
  }, [image, scale, rotation, country, displayWidth]);

  const handleCountryChange = (e) => {
    const selected = COUNTRIES.find((c) => c.id === e.target.value);
    setCountry(selected);
    setPosition({ x: 0, y: 0 }); 
    setGeneratedSheet(null);
    setLayoutWarning(null);
  };

  const handleRotate = () => {
    const newRot = (rotation + 90) % 360;
    setRotation(newRot);
    setPosition(prev => clampPosition(prev.x, prev.y, scale, newRot, country));
    setGeneratedSheet(null);
  };

  const handleCropToPassport = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
    setGeneratedSheet(null);
  };

  const handleScaleChange = (e) => {
    const newScale = parseFloat(e.target.value);
    setScale(newScale);
    setPosition(prev => clampPosition(prev.x, prev.y, newScale, rotation, country));
    setGeneratedSheet(null);
  };

  const handlePointerDown = (e) => {
    if (!image) return;
    setIsDragging(true);
    setGeneratedSheet(null);
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    setDragStart({ x: clientX - position.x, y: clientY - position.y });
  };

  const handlePointerMove = (e) => {
    if (!isDragging) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    const rawX = clientX - dragStart.x;
    const rawY = clientY - dragStart.y;
    
    setPosition(clampPosition(rawX, rawY));
  };

  const handlePointerUp = () => {
    setIsDragging(false);
  };

  const handleFineMove = (dx, dy) => {
    if (!image) return;
    setPosition(prev => clampPosition(prev.x + dx, prev.y + dy, scale, rotation, country));
    setGeneratedSheet(null);
  };

  const drawEditorCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;

    const ctx = canvas.getContext('2d');
    canvas.width = displayWidth;
    canvas.height = displayHeight;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const cx = canvas.width / 2;
    const cy = canvas.height / 2;

    const isRotated90 = rotation % 180 !== 0;
    const imgW = isRotated90 ? image.height : image.width;
    const imgH = isRotated90 ? image.width : image.height;

    const imgAspect = imgW / imgH;
    const canvasAspect = canvas.width / canvas.height;
    let baseScale = 1;
    
    if (imgAspect > canvasAspect) {
      baseScale = canvas.height / imgH;
    } else {
      baseScale = canvas.width / imgW;
    }

    const finalScale = baseScale * scale;

    ctx.save();
    ctx.translate(cx + position.x, cy + position.y);
    ctx.scale(finalScale, finalScale);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`;
    ctx.drawImage(image, -image.width / 2, -image.height / 2);
    ctx.restore();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(canvas.width / 3, 0); ctx.lineTo(canvas.width / 3, canvas.height);
    ctx.moveTo((canvas.width * 2) / 3, 0); ctx.lineTo((canvas.width * 2) / 3, canvas.height);
    ctx.moveTo(0, canvas.height / 3); ctx.lineTo(canvas.width, canvas.height / 3);
    ctx.moveTo(0, (canvas.height * 2) / 3); ctx.lineTo(canvas.width, (canvas.height * 2) / 3);
    ctx.stroke();

  }, [image, country, scale, position, brightness, contrast, saturation, rotation, displayWidth, displayHeight]);

  useEffect(() => {
    drawEditorCanvas();
  }, [drawEditorCanvas]);

  const generatePrintSheet = useCallback(() => {
    if (!image) return;

    setLayoutWarning(null);

    const cropCanvas = document.createElement('canvas');
    const cropCtx = cropCanvas.getContext('2d');
    const { widthPx, heightPx } = country;
    cropCanvas.width = widthPx;
    cropCanvas.height = heightPx;

    const cx = widthPx / 2;
    const cy = heightPx / 2;
    const scaleRatio = widthPx / displayWidth;

    const isRotated90 = rotation % 180 !== 0;
    const imgW = isRotated90 ? image.height : image.width;
    const imgH = isRotated90 ? image.width : image.height;

    const imgAspect = imgW / imgH;
    const canvasAspect = displayWidth / displayHeight;
    let baseScale = 1;
    if (imgAspect > canvasAspect) {
      baseScale = displayHeight / imgH;
    } else {
      baseScale = displayWidth / imgW;
    }

    const finalScale = baseScale * scale * scaleRatio;

    cropCtx.fillStyle = '#ffffff';
    cropCtx.fillRect(0, 0, widthPx, heightPx);

    cropCtx.save();
    cropCtx.translate(cx + position.x * scaleRatio, cy + position.y * scaleRatio);
    cropCtx.scale(finalScale, finalScale);
    cropCtx.rotate((rotation * Math.PI) / 180);
    cropCtx.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`;
    cropCtx.drawImage(image, -image.width / 2, -image.height / 2);
    cropCtx.restore();

    if (showBorder) {
      cropCtx.strokeStyle = '#000000'; // Pure solid black cutting line
      cropCtx.lineWidth = 2;
      cropCtx.strokeRect(1, 1, widthPx - 2, heightPx - 2);
    }

    const sheetCanvas = document.createElement('canvas');
    const sheetCtx = sheetCanvas.getContext('2d');
    
    const sheetW = SHEET_SIZES[0].widthPx;
    const sheetH = SHEET_SIZES[0].heightPx;
    const gapPx = Math.round(gapMm * (DPI / INCH_TO_MM));
    
    let finalCols = 0;
    let finalRows = 0;
    let isLandscape = true;
    let finalSheetW = sheetW;
    let finalSheetH = sheetH;

    if (layoutMode === 'auto') {
      const landCols = Math.floor((sheetW + gapPx) / (widthPx + gapPx));
      const landRows = Math.floor((sheetH + gapPx) / (heightPx + gapPx));
      const portCols = Math.floor((sheetH + gapPx) / (widthPx + gapPx));
      const portRows = Math.floor((sheetW + gapPx) / (heightPx + gapPx));
      
      isLandscape = (landCols * landRows) >= (portCols * portRows);
      
      finalSheetW = isLandscape ? sheetW : sheetH;
      finalSheetH = isLandscape ? sheetH : sheetW;
      finalCols = isLandscape ? landCols : portCols;
      finalRows = isLandscape ? landRows : portRows;
    } else {
      finalSheetW = sheetW; 
      finalSheetH = sheetH;
      finalCols = manualCols;
      finalRows = manualRows;
    }

    sheetCanvas.width = finalSheetW;
    sheetCanvas.height = finalSheetH;

    sheetCtx.fillStyle = '#ffffff';
    sheetCtx.fillRect(0, 0, sheetCanvas.width, sheetCanvas.height);

    const totalW = (finalCols * widthPx) + ((finalCols - 1) * gapPx);
    const totalH = (finalRows * heightPx) + ((finalRows - 1) * gapPx);
    const startX = (sheetCanvas.width - totalW) / 2;
    const startY = (sheetCanvas.height - totalH) / 2;

    if (layoutMode === 'manual' && (totalW > sheetCanvas.width || totalH > sheetCanvas.height)) {
      setLayoutWarning("Warning: The grid exceeds the 4x6 print bounds. Photos will be cut off.");
    }

    for (let r = 0; r < finalRows; r++) {
      for (let c = 0; c < finalCols; c++) {
        const x = startX + c * (widthPx + gapPx);
        const y = startY + r * (heightPx + gapPx);
        sheetCtx.drawImage(cropCanvas, x, y);
      }
    }

    setGeneratedSheet(sheetCanvas.toDataURL('image/jpeg', 0.95));
  }, [image, country, scale, position, brightness, contrast, saturation, rotation, gapMm, layoutMode, manualCols, manualRows, displayWidth, displayHeight, showBorder]);

  useEffect(() => {
    if (generatedSheet) {
      generatePrintSheet();
    }
  }, [gapMm, layoutMode, manualCols, manualRows]); 

  const handleDownload = () => {
    if (!generatedSheet) return;
    const link = document.createElement('a');
    link.href = generatedSheet;
    link.download = `passport-sheet-4x6-${country.id}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrintClick = () => {
    if (!generatedSheet) return;
    setShowPrintModal(true);
    setConnectionStatus('idle');
    setConnectionType(null);
    setSelectedPrinter(null);
  };

  const handleConnect = (type) => {
    setConnectionType(type);
    setConnectionStatus('searching');
    setTimeout(() => {
      setConnectionStatus('list');
    }, 1500);
  };

  const handleSelectPrinter = (printer) => {
    setSelectedPrinter(printer);
    setConnectionStatus('connecting');
    setTimeout(() => {
      setConnectionStatus('success');
      setTimeout(() => {
        setShowPrintModal(false);
        executePrint();
      }, 1000);
    }, 2000);
  };

  const executePrint = () => {
    if (!generatedSheet) return;
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>Print Passport Photos</title>
          <style>
            body { margin: 0; padding: 0; display: flex; justify-content: center; align-items: center; background: #333; height: 100vh; }
            img { max-width: 100%; max-height: 100%; box-shadow: 0 0 20px rgba(0,0,0,0.5); }
            @media print {
              body { background: #fff; height: auto; }
              img { box-shadow: none; width: 6in; height: 4in; object-fit: contain; }
              @page { margin: 0; size: 6in 4in landscape; }
            }
          </style>
        </head>
        <body>
          <img src="${generatedSheet}" onload="window.print(); window.close();" />
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="h-screen w-full bg-slate-100 text-slate-900 font-sans flex flex-col sm:max-w-md sm:mx-auto sm:shadow-2xl relative overflow-hidden">
      
      {/* Android Material App Bar */}
      <header className="bg-blue-600 text-white px-4 py-3.5 shadow-md flex items-center justify-between z-20 shrink-0">
        <div className="flex items-center space-x-3">
          <ImageIcon className="w-6 h-6 text-white" />
          <h1 className="text-xl font-medium tracking-wide">PassportPhoto</h1>
        </div>
        {!image ? (
          <Settings2 className="w-5 h-5 text-blue-200" />
        ) : (
          <button onClick={() => fileInputRef.current?.click()} className="text-blue-100 active:text-white transition-colors p-1">
            <Upload className="w-5 h-5" />
          </button>
        )}
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleImageUpload} 
          onClick={(e) => { e.target.value = null; }}
          accept="image/*" 
          className="hidden" 
        />
      </header>

      {/* Main Scrollable Content */}
      <main className="flex-1 overflow-y-auto pb-28 relative scroll-smooth">
        {!image ? (
          <div className="flex flex-col items-center justify-center h-full p-6 text-center animate-in fade-in zoom-in duration-300">
            <div className="bg-blue-100 w-32 h-32 rounded-full flex items-center justify-center mb-6 shadow-inner">
              <ImageIcon className="w-16 h-16 text-blue-600" />
            </div>
            <h2 className="text-2xl font-semibold text-slate-800 mb-3">Create Passport Photo</h2>
            <p className="text-slate-500 mb-8 max-w-xs text-sm">Select a photo from your gallery to generate a perfect 4x6 print sheet.</p>
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="w-full bg-blue-600 text-white py-4 px-6 rounded-2xl font-semibold text-lg shadow-lg active:bg-blue-700 active:scale-[0.98] transition-all flex items-center justify-center"
            >
              <Upload className="w-6 h-6 mr-2" /> Choose Photo
            </button>
          </div>
        ) : (
          <div className="p-4 space-y-4 animate-in slide-in-from-bottom-4 duration-300">
            
            {/* Step 1: Configuration Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Target Country & Size</label>
              <div className="relative">
                <select 
                  value={country.id}
                  onChange={handleCountryChange}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 font-medium rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent block p-3.5 appearance-none"
                >
                  {COUNTRIES.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-3.5 w-5 h-5 text-slate-400 pointer-events-none" />
              </div>
            </div>

            {/* Step 2: Editor Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
              <div className="flex items-center justify-between mb-4">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Position & Crop</label>
                <button 
                  onClick={() => setShowAdjustments(!showAdjustments)}
                  className={`flex items-center text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${showAdjustments ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600 active:bg-slate-200'}`}
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 mr-1" /> Edit
                </button>
              </div>

              {/* Canvas Area */}
              <div className="flex justify-center mb-2">
                <div className="relative overflow-hidden bg-slate-100 rounded-xl shadow-inner cursor-move border border-slate-200 touch-none"
                  onMouseDown={handlePointerDown}
                  onMouseMove={handlePointerMove}
                  onMouseUp={handlePointerUp}
                  onMouseLeave={handlePointerUp}
                  onTouchStart={handlePointerDown}
                  onTouchMove={handlePointerMove}
                  onTouchEnd={handlePointerUp}
                  style={{ width: displayWidth, height: displayHeight }}
                >
                  <canvas ref={canvasRef} className="absolute top-0 left-0" />
                </div>
              </div>
              
              <div className="flex items-center justify-between mt-3 px-2">
                <p className="text-[11px] text-slate-400 flex items-center">
                  <Move className="w-3 h-3 mr-1" /> Drag to position
                </p>
                <div className="flex gap-1 bg-slate-50 p-1 rounded-lg border border-slate-100">
                  <button onClick={() => handleFineMove(0, -5)} className="p-1.5 bg-white rounded shadow-sm active:bg-blue-50 active:text-blue-600 transition-colors"><ArrowUp className="w-3.5 h-3.5 text-slate-600"/></button>
                  <button onClick={() => handleFineMove(0, 5)} className="p-1.5 bg-white rounded shadow-sm active:bg-blue-50 active:text-blue-600 transition-colors"><ArrowDown className="w-3.5 h-3.5 text-slate-600"/></button>
                  <button onClick={() => handleFineMove(-5, 0)} className="p-1.5 bg-white rounded shadow-sm active:bg-blue-50 active:text-blue-600 transition-colors"><ArrowLeft className="w-3.5 h-3.5 text-slate-600"/></button>
                  <button onClick={() => handleFineMove(5, 0)} className="p-1.5 bg-white rounded shadow-sm active:bg-blue-50 active:text-blue-600 transition-colors"><ArrowRight className="w-3.5 h-3.5 text-slate-600"/></button>
                </div>
              </div>

              {/* Adjustments */}
              {showAdjustments && (
                <div className="mt-4 pt-4 border-t border-slate-100 space-y-5 animate-in slide-in-from-top-2">
                  
                  {/* Cutting Lines Toggle Card */}
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex justify-between items-center">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cutting Border Lines</span>
                    <button 
                      onClick={() => { setShowBorder(!showBorder); setGeneratedSheet(null); }}
                      className={`flex items-center text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${showBorder ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600 active:bg-slate-200'}`}
                    >
                      <Square className="w-3.5 h-3.5 mr-1" /> Black Lines: {showBorder ? 'On' : 'Off'}
                    </button>
                  </div>

                  <div className="flex justify-between items-center mb-2">
                    <button onClick={handleCropToPassport} className="flex items-center text-xs font-semibold text-blue-700 bg-blue-50 active:bg-blue-100 px-3 py-2 rounded-xl transition-colors">
                      <Crop className="w-3.5 h-3.5 mr-1.5" /> Crop to Passport Ratio
                    </button>
                    <button onClick={handleRotate} className="flex items-center text-xs font-semibold text-slate-600 bg-slate-100 active:bg-slate-200 px-3 py-2 rounded-xl">
                      <RotateCw className="w-3.5 h-3.5 mr-1.5" /> Rotate 90°
                    </button>
                  </div>
                  <div>
                    <label className="flex justify-between text-xs font-semibold text-slate-600 mb-2">
                      <span className="flex items-center"><ZoomIn className="w-3.5 h-3.5 mr-1.5"/> Zoom</span>
                      <span className="text-blue-600">{scale.toFixed(2)}x</span>
                    </label>
                    <input type="range" min="1" max="4" step="0.01" value={scale} onChange={handleScaleChange} className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none accent-blue-600" />
                  </div>
                  <div>
                    <label className="flex justify-between text-xs font-semibold text-slate-600 mb-2">
                      <span className="flex items-center"><Sun className="w-3.5 h-3.5 mr-1.5"/> Brightness</span>
                      <span>{brightness}%</span>
                    </label>
                    <input type="range" min="0" max="200" value={brightness} onChange={(e) => { setBrightness(e.target.value); setGeneratedSheet(null); }} className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none accent-blue-600" />
                  </div>
                  <div className="flex gap-4">
                     <div className="flex-1">
                        <label className="flex text-xs font-semibold text-slate-600 mb-2">Contrast</label>
                        <input type="range" min="0" max="200" value={contrast} onChange={(e) => { setContrast(e.target.value); setGeneratedSheet(null); }} className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none accent-blue-600" />
                     </div>
                     <div className="flex-1">
                        <label className="flex text-xs font-semibold text-slate-600 mb-2">Saturation</label>
                        <input type="range" min="0" max="200" value={saturation} onChange={(e) => { setSaturation(e.target.value); setGeneratedSheet(null); }} className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none accent-blue-600" />
                     </div>
                  </div>
                </div>
              )}
            </div>

            {/* Step 3: Layout Settings */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
              <div className="flex items-center justify-between mb-4">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Print Layout</label>
                <div className="flex bg-slate-100 p-1 rounded-xl">
                  <button onClick={() => setLayoutMode('auto')} className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${layoutMode === 'auto' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 active:bg-slate-200'}`}>Auto</button>
                  <button onClick={() => setLayoutMode('manual')} className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${layoutMode === 'manual' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 active:bg-slate-200'}`}>Manual</button>
                </div>
              </div>
              
              <div className="space-y-5">
                <div>
                  <label className="flex justify-between text-xs font-semibold text-slate-600 mb-2">
                    <span>Photo Spacing</span>
                    <span className="text-blue-600">{gapMm} mm</span>
                  </label>
                  <input type="range" min="0" max="15" step="0.5" value={gapMm} onChange={(e) => setGapMm(parseFloat(e.target.value))} className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none accent-blue-600" />
                </div>
                
                {layoutMode === 'manual' && (
                  <div className="flex gap-4 animate-in fade-in">
                    <div className="flex-1">
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">Rows</label>
                      <input type="number" min="1" max="10" value={manualRows} onChange={(e) => setManualRows(Math.max(1, parseInt(e.target.value) || 1))} className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-xl p-3 focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">Columns</label>
                      <input type="number" min="1" max="10" value={manualCols} onChange={(e) => setManualCols(Math.max(1, parseInt(e.target.value) || 1))} className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-xl p-3 focus:ring-2 focus:ring-blue-500" />
                    </div>
                  </div>
                )}
                
                {layoutWarning && (
                  <div className="bg-orange-50 border border-orange-100 text-orange-700 text-[11px] p-3 rounded-xl flex items-start">
                    <AlertTriangle className="w-4 h-4 mr-2 flex-shrink-0" />
                    <p>{layoutWarning}</p>
                  </div>
                )}

                <button 
                  onClick={generatePrintSheet}
                  className="w-full bg-blue-50 active:bg-blue-100 text-blue-700 py-3 rounded-xl font-semibold text-sm transition-colors flex justify-center items-center"
                >
                  <LayoutGrid className="w-4 h-4 mr-2" /> 
                  {generatedSheet ? "Regenerate Grid" : "Generate Grid Layout"}
                </button>
              </div>
            </div>

            {/* Generated Output Preview */}
            {generatedSheet && (
              <div className="bg-slate-200 rounded-2xl p-2 flex justify-center shadow-inner animate-in zoom-in-95 duration-300">
                <img src={generatedSheet} alt="Print Sheet" className="max-w-full rounded shadow-md" />
              </div>
            )}
            
          </div>
        )}
      </main>

      {/* Sticky Bottom Action Bar (App Style) */}
      {image && generatedSheet && (
        <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4 shadow-[0_-10px_20px_-5px_rgba(0,0,0,0.05)] z-20 animate-in slide-in-from-bottom-full">
          <div className="flex gap-3">
            <button 
              onClick={handleDownload}
              className="flex-1 bg-slate-100 active:bg-slate-200 text-slate-700 py-4 px-4 rounded-2xl font-semibold text-sm transition-all flex justify-center items-center"
            >
              <Download className="w-5 h-5 mr-1.5" /> Save
            </button>
            <button 
              onClick={handlePrintClick}
              className="flex-[2] bg-blue-600 active:bg-blue-700 text-white py-4 px-4 rounded-2xl font-semibold text-sm shadow-lg active:scale-[0.98] transition-all flex justify-center items-center"
            >
              <Printer className="w-5 h-5 mr-1.5" /> Print
            </button>
          </div>
        </div>
      )}

      {/* Print Modal (Android Bottom Sheet) */}
      {showPrintModal && (
        <div className="absolute inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={() => setShowPrintModal(false)}></div>
          <div className="bg-white rounded-t-3xl shadow-2xl relative z-10 animate-in slide-in-from-bottom-full duration-300 w-full pb-6">
            <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mt-4 mb-2"></div>
            
            <div className="px-6 pb-6 pt-2 min-h-[300px] flex flex-col">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-semibold text-slate-900 flex items-center">
                  <Printer className="w-6 h-6 mr-2 text-blue-600" /> Connect Printer
                </h3>
                <button onClick={() => setShowPrintModal(false)} className="p-2 bg-slate-100 active:bg-slate-200 rounded-full text-slate-500 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="flex-1 flex flex-col justify-center">
                {connectionStatus === 'idle' && (
                  <div className="animate-in fade-in duration-300">
                    <p className="text-slate-600 mb-6 text-center text-sm">Select connection method to find nearby printers.</p>
                    <div className="grid grid-cols-2 gap-4">
                      <button onClick={() => handleConnect('wifi')} className="flex flex-col items-center p-5 border-2 border-slate-100 rounded-3xl active:bg-blue-50 active:border-blue-300 transition-colors">
                        <div className="bg-blue-50 p-4 rounded-full mb-3"><Wifi className="w-8 h-8 text-blue-600" /></div>
                        <span className="font-semibold text-slate-800">Wi-Fi</span>
                      </button>
                      <button onClick={() => handleConnect('bluetooth')} className="flex flex-col items-center p-5 border-2 border-slate-100 rounded-3xl active:bg-blue-50 active:border-blue-300 transition-colors">
                        <div className="bg-blue-50 p-4 rounded-full mb-3"><Bluetooth className="w-8 h-8 text-blue-600" /></div>
                        <span className="font-semibold text-slate-800">Bluetooth</span>
                      </button>
                    </div>
                  </div>
                )}
                
                {connectionStatus === 'searching' && (
                  <div className="flex flex-col items-center text-center animate-in fade-in">
                    <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
                    <h4 className="text-lg font-semibold text-slate-800 mb-1">Searching...</h4>
                    <p className="text-sm text-slate-500">Scanning via {connectionType === 'wifi' ? 'Wi-Fi' : 'Bluetooth'}</p>
                  </div>
                )}

                {connectionStatus === 'list' && (
                  <div className="animate-in fade-in slide-in-from-bottom-4">
                    <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                      {MOCK_PRINTERS.map((printer, idx) => (
                        <button key={idx} onClick={() => handleSelectPrinter(printer)} className="w-full flex items-center p-4 border border-slate-100 rounded-2xl active:bg-slate-50 transition-colors text-left">
                          <Printer className="w-6 h-6 text-slate-400 mr-4" />
                          <span className="font-medium text-slate-800">{printer}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {connectionStatus === 'connecting' && (
                  <div className="flex flex-col items-center text-center animate-in fade-in">
                    <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
                    <h4 className="text-lg font-semibold text-slate-800 mb-1">Connecting...</h4>
                    <p className="text-sm text-slate-500">{selectedPrinter}</p>
                  </div>
                )}

                {connectionStatus === 'success' && (
                  <div className="flex flex-col items-center text-center animate-in zoom-in">
                    <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-5">
                      <CheckCircle2 className="w-10 h-10 text-green-600" />
                    </div>
                    <h4 className="text-2xl font-bold text-slate-800 mb-2">Ready to Print!</h4>
                    <p className="text-sm text-slate-500">Opening Android Print Service...</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}