import { useState, useEffect, useRef } from "react";
import { supabase, BUCKET } from "./supabase";
import {
  Plus, Trash2, Edit3, X, Camera, ArrowLeft, Eye,
  Share2, Package, Check, Copy, Phone, ChevronLeft,
  ChevronRight, Lock, Loader2, AlertCircle
} from "lucide-react";

/* ═══════════════════════════════════════════
   Constants & Utilities
   ═══════════════════════════════════════════ */

const SIZES = ["35","36","37","38","39","40","41","42","43","44","45","46"];
const ADMIN_PWD = import.meta.env.VITE_ADMIN_PWD || "";
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

const compressImg = (file, maxW = 800, q = 0.7) =>
  new Promise((ok, no) => {
    const r = new FileReader();
    r.onload = (e) => {
      const img = document.createElement("img");
      img.onload = () => {
        const c = document.createElement("canvas");
        let w = img.naturalWidth, h = img.naturalHeight;
        if (w > maxW) { h = Math.round((h * maxW) / w); w = maxW; }
        c.width = w; c.height = h;
        c.getContext("2d").drawImage(img, 0, 0, w, h);
        c.toBlob((blob) => ok(blob), "image/jpeg", q);
      };
      img.onerror = no;
      img.src = e.target.result;
    };
    r.onerror = no;
    r.readAsDataURL(file);
  });

const copyTxt = async (t) => {
  try { await navigator.clipboard.writeText(t); } catch {
    const a = document.createElement("textarea");
    a.value = t; document.body.appendChild(a);
    a.select(); document.execCommand("copy");
    document.body.removeChild(a);
  }
};

/* ═══════════════════════════════════════════
   Supabase Helpers
   ═══════════════════════════════════════════ */

async function uploadImg(file, productId) {
  const blob = await compressImg(file);
  const path = `${productId}/${uid()}.jpg`;
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: "image/jpeg" });
  if (error) throw error;
  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(data.path);
  return urlData.publicUrl;
}

async function deleteImg(url) {
  try {
    const marker = `/storage/v1/object/public/${BUCKET}/`;
    const idx = url.indexOf(marker);
    if (idx === -1) return;
    const path = url.slice(idx + marker.length);
    await supabase.storage.from(BUCKET).remove([path]);
  } catch (e) { console.warn("Image delete failed:", e); }
}

async function fetchAll() {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

async function fetchOne(id) {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("id", id)
    .single();
  if (error) return null;
  return data;
}

async function upsertProduct(product) {
  const { error } = await supabase.from("products").upsert({
    id: product.id,
    name: product.name,
    contact: product.contact,
    colors: product.colors,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

async function removeProduct(product) {
  const allImgs = product.colors?.flatMap((c) => c.images || []) || [];
  await Promise.allSettled(allImgs.map(deleteImg));
  const { error } = await supabase.from("products").delete().eq("id", product.id);
  if (error) throw error;
}

/* ═══════════════════════════════════════════
   Full-screen Image Viewer
   ═══════════════════════════════════════════ */

function Viewer({ images, start = 0, onClose }) {
  const [i, setI] = useState(start);
  const tx = useRef(null);
  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col"
      onTouchStart={(e) => { tx.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        if (tx.current == null) return;
        const d = tx.current - e.changedTouches[0].clientX;
        if (d > 50 && i < images.length - 1) setI(i + 1);
        else if (d < -50 && i > 0) setI(i - 1);
        tx.current = null;
      }}>
      <button className="absolute top-4 right-4 z-10 text-white/70 p-2" onClick={onClose}>
        <X size={24} />
      </button>
      <div className="flex-1 flex items-center justify-center p-2">
        <img src={images[i]} className="max-w-full max-h-full object-contain select-none" alt="" />
      </div>
      {images.length > 1 && (
        <div className="flex justify-center gap-1.5 pb-8">
          {images.map((_, j) => (
            <div key={j} className={`h-1.5 rounded-full transition-all ${j === i ? "bg-white w-4" : "bg-white/30 w-1.5"}`} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════
   QR Code Modal
   ═══════════════════════════════════════════ */

function QRModal({ product, onClose }) {
  const url = `${window.location.origin}/p/${product.id}`;
  const [ok, setOk] = useState(false);
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-40 p-6" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 max-w-xs w-full text-center shadow-xl" onClick={(e) => e.stopPropagation()}>
        <p className="font-semibold text-lg text-stone-900">{product.name}</p>
        <p className="text-xs text-stone-400 mt-1 mb-4">客户扫码查看商品</p>
        <img
          src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}`}
          className="mx-auto rounded-lg" alt="QR" width={200} height={200}
        />
        <p className="text-[11px] text-stone-400 mt-3 font-mono break-all leading-relaxed">{url}</p>
        <div className="flex gap-3 justify-center mt-4">
          <button onClick={() => { copyTxt(url); setOk(true); setTimeout(() => setOk(false), 2000); }}
            className="text-sm px-3 py-1.5 rounded-lg bg-stone-100 text-stone-600 flex items-center gap-1 active:bg-stone-200">
            {ok ? <><Check size={14} /> 已复制</> : <><Copy size={14} /> 复制链接</>}
          </button>
          <button onClick={onClose} className="text-sm px-3 py-1.5 rounded-lg text-stone-400">关闭</button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   Customer Product Display
   ═══════════════════════════════════════════ */

function Display({ product, onBack, isPreview }) {
  const [ci, setCi] = useState(0);
  const [ii, setIi] = useState(0);
  const [vw, setVw] = useState(null);
  const [copied, setCopied] = useState(false);
  const tx = useRef(null);

  const clr = product.colors?.[ci] || { name: "", images: [], sizes: [] };
  const imgs = clr.images || [];
  const switchColor = (i) => { setCi(i); setIi(0); };

  return (
    <div className="min-h-screen bg-white">
      {isPreview && (
        <div className="bg-stone-800 text-white/80 text-center py-2 text-xs flex items-center justify-center gap-1.5">
          <Eye size={12} /> 预览模式
        </div>
      )}

      <div className="relative">
        {onBack && (
          <button onClick={onBack}
            className="absolute top-3 left-3 z-10 bg-white/90 backdrop-blur rounded-full p-2 shadow">
            <ArrowLeft size={18} />
          </button>
        )}

        <div className="aspect-square bg-stone-100 relative overflow-hidden cursor-pointer"
          onTouchStart={(e) => { tx.current = e.touches[0].clientX; }}
          onTouchEnd={(e) => {
            if (tx.current == null) return;
            const d = tx.current - e.changedTouches[0].clientX;
            if (d > 50 && ii < imgs.length - 1) setIi(ii + 1);
            else if (d < -50 && ii > 0) setIi(ii - 1);
            tx.current = null;
          }}
          onClick={() => imgs.length > 0 && setVw(ii)}>

          {imgs.length > 0
            ? <img src={imgs[ii]} className="w-full h-full object-cover" alt={product.name} />
            : <div className="w-full h-full flex items-center justify-center text-stone-300"><Camera size={48} /></div>}

          {imgs.length > 1 && ii > 0 && (
            <button onClick={(e) => { e.stopPropagation(); setIi(ii - 1); }}
              className="hidden sm:flex absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 rounded-full p-1.5 shadow">
              <ChevronLeft size={18} />
            </button>
          )}
          {imgs.length > 1 && ii < imgs.length - 1 && (
            <button onClick={(e) => { e.stopPropagation(); setIi(ii + 1); }}
              className="hidden sm:flex absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 rounded-full p-1.5 shadow">
              <ChevronRight size={18} />
            </button>
          )}
        </div>

        {imgs.length > 1 && (
          <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5 pointer-events-none">
            {imgs.map((_, j) => (
              <div key={j} className={`h-1.5 rounded-full transition-all ${j === ii ? "bg-stone-800 w-4" : "bg-stone-800/25 w-1.5"}`} />
            ))}
          </div>
        )}
      </div>

      <div className="px-5 pt-5 pb-10">
        <h1 className="text-xl font-bold text-stone-900">{product.name}</h1>

        {product.colors?.length > 0 && (
          <div className="mt-4">
            <p className="text-xs text-stone-400 mb-2 tracking-wide">配色</p>
            <div className="flex flex-wrap gap-2">
              {product.colors.map((c, i) => (
                <button key={i} onClick={() => switchColor(i)}
                  className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition-all ${
                    i === ci ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-600 active:bg-stone-200"
                  }`}>
                  {c.name || `配色${i + 1}`}
                </button>
              ))}
            </div>
          </div>
        )}

        {clr.sizes?.length > 0 && (
          <div className="mt-5">
            <p className="text-xs text-stone-400 mb-2 tracking-wide">可选尺码</p>
            <div className="flex flex-wrap gap-2">
              {clr.sizes.map((s) => (
                <span key={s} className="w-11 h-9 rounded-lg bg-stone-50 border border-stone-200 flex items-center justify-center text-sm text-stone-700 font-medium">
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}

        {product.contact && (
          <div className="mt-8 p-4 rounded-xl bg-stone-50 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-stone-200 flex items-center justify-center">
                <Phone size={16} className="text-stone-500" />
              </div>
              <div>
                <p className="text-xs text-stone-400">联系方式</p>
                <p className="text-sm font-medium text-stone-900 mt-0.5">{product.contact}</p>
              </div>
            </div>
            <button
              onClick={() => { copyTxt(product.contact); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
              className="text-xs px-2.5 py-1 rounded-md bg-white border border-stone-200 text-stone-500 active:bg-stone-100">
              {copied ? "已复制" : "复制"}
            </button>
          </div>
        )}
      </div>

      {vw !== null && <Viewer images={imgs} start={vw} onClose={() => setVw(null)} />}
    </div>
  );
}

/* ═══════════════════════════════════════════
   Admin Product Form
   ═══════════════════════════════════════════ */

function Form({ init, onSave, onCancel }) {
  const [p, setP] = useState(() => JSON.parse(JSON.stringify(init)));
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");

  const setField = (k, v) => setP({ ...p, [k]: v });

  const updateColor = (ci, patch) => {
    const colors = [...p.colors];
    colors[ci] = { ...colors[ci], ...patch };
    setP({ ...p, colors });
  };

  const addColor = () =>
    setP({ ...p, colors: [...p.colors, { name: "", images: [], sizes: [] }] });

  const removeColor = (ci) =>
    setP({ ...p, colors: p.colors.filter((_, i) => i !== ci) });

  const addImages = async (ci, files) => {
    setBusy(true);
    const arr = Array.from(files);
    const urls = [];
    for (let k = 0; k < arr.length; k++) {
      setUploadProgress(`上传中 ${k + 1}/${arr.length}`);
      try {
        const url = await uploadImg(arr[k], p.id);
        urls.push(url);
      } catch (e) {
        console.error("Upload failed:", e);
        alert(`第 ${k + 1} 张图片上传失败，请重试`);
      }
    }
    if (urls.length > 0) {
      const colors = [...p.colors];
      colors[ci] = { ...colors[ci], images: [...colors[ci].images, ...urls] };
      setP({ ...p, colors });
    }
    setBusy(false);
    setUploadProgress("");
  };

  const removeImage = async (ci, ii) => {
    const url = p.colors[ci].images[ii];
    const colors = [...p.colors];
    colors[ci] = { ...colors[ci], images: colors[ci].images.filter((_, i) => i !== ii) };
    setP({ ...p, colors });
    await deleteImg(url);
  };

  const toggleSize = (ci, size) => {
    const colors = [...p.colors];
    const c = colors[ci];
    const has = c.sizes.includes(size);
    colors[ci] = {
      ...c,
      sizes: has ? c.sizes.filter((s) => s !== size) : [...c.sizes, size].sort((a, b) => +a - +b),
    };
    setP({ ...p, colors });
  };

  const selectAllSizes = (ci) => {
    const colors = [...p.colors];
    const allSelected = SIZES.every((s) => colors[ci].sizes.includes(s));
    colors[ci] = { ...colors[ci], sizes: allSelected ? [] : [...SIZES] };
    setP({ ...p, colors });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await upsertProduct(p);
      onSave(p);
    } catch (e) {
      alert("保存失败: " + e.message);
    }
    setSaving(false);
  };

  const ok = p.name.trim() && p.colors.length > 0 && !busy && !saving;

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="max-w-lg mx-auto px-4 py-4 pb-8">
        <div className="flex items-center gap-3 mb-5">
          <button onClick={onCancel} className="p-1 text-stone-600"><ArrowLeft size={20} /></button>
          <h2 className="text-lg font-bold text-stone-900">{init.name ? "编辑商品" : "添加商品"}</h2>
        </div>

        <div className="bg-white rounded-xl p-4 mb-3 shadow-sm">
          <label className="text-xs text-stone-400 font-medium">商品名称 *</label>
          <input value={p.name} onChange={(e) => setField("name", e.target.value)}
            placeholder="例：Air Jordan 1 Low"
            className="w-full mt-1.5 px-3 py-2.5 rounded-lg bg-stone-50 border border-stone-200 text-sm focus:outline-none focus:border-stone-400 text-stone-900 placeholder:text-stone-300" />
          <label className="text-xs text-stone-400 font-medium mt-4 block">联系方式</label>
          <input value={p.contact} onChange={(e) => setField("contact", e.target.value)}
            placeholder="微信号 / 手机号"
            className="w-full mt-1.5 px-3 py-2.5 rounded-lg bg-stone-50 border border-stone-200 text-sm focus:outline-none focus:border-stone-400 text-stone-900 placeholder:text-stone-300" />
        </div>

        {p.colors.map((c, ci) => (
          <div key={ci} className="bg-white rounded-xl p-4 mb-3 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-stone-500 tracking-wide">配色 {ci + 1}</span>
              {p.colors.length > 1 && (
                <button onClick={() => removeColor(ci)}
                  className="text-xs text-red-400 flex items-center gap-0.5 active:text-red-600">
                  <Trash2 size={12} /> 删除
                </button>
              )}
            </div>

            <input value={c.name} onChange={(e) => updateColor(ci, { name: e.target.value })}
              placeholder="配色名称，如：黑白熊猫"
              className="w-full px-3 py-2 rounded-lg bg-stone-50 border border-stone-200 text-sm focus:outline-none focus:border-stone-400 text-stone-900 placeholder:text-stone-300 mb-3" />

            <p className="text-xs text-stone-400 font-medium mb-2">图片</p>
            <div className="flex gap-2 flex-wrap mb-4">
              {c.images.map((img, ii) => (
                <div key={ii} className="relative w-16 h-16 rounded-lg overflow-hidden bg-stone-100">
                  <img src={img} className="w-full h-full object-cover" alt="" />
                  <button onClick={() => removeImage(ci, ii)}
                    className="absolute -top-0.5 -right-0.5 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center">
                    <X size={10} />
                  </button>
                </div>
              ))}
              <label className={`w-16 h-16 rounded-lg border-2 border-dashed border-stone-300 flex flex-col items-center justify-center cursor-pointer active:border-stone-400 transition-colors ${busy ? "opacity-40 pointer-events-none" : ""}`}>
                <Plus size={18} className="text-stone-400" />
                <span className="text-[10px] text-stone-400 mt-0.5">添加</span>
                <input type="file" multiple accept="image/*" className="hidden"
                  onChange={(e) => { if (e.target.files.length) addImages(ci, e.target.files); e.target.value = ""; }} />
              </label>
            </div>

            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-stone-400 font-medium">尺码</p>
              <button onClick={() => selectAllSizes(ci)} className="text-[11px] text-stone-400 underline">
                {SIZES.every((s) => c.sizes.includes(s)) ? "取消全选" : "全选"}
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {SIZES.map((s) => (
                <button key={s} onClick={() => toggleSize(ci, s)}
                  className={`w-10 h-8 rounded-md text-xs font-medium transition-all ${
                    c.sizes.includes(s) ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-500 active:bg-stone-200"
                  }`}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        ))}

        <button onClick={addColor}
          className="w-full py-2.5 rounded-xl border-2 border-dashed border-stone-300 text-sm text-stone-500 flex items-center justify-center gap-1 mb-5 active:bg-stone-100">
          <Plus size={16} /> 添加配色
        </button>

        <div className="flex gap-3">
          <button onClick={onCancel}
            className="flex-1 py-3 rounded-xl bg-stone-200 text-stone-600 text-sm font-medium active:bg-stone-300">
            取消
          </button>
          <button onClick={handleSave} disabled={!ok}
            className={`flex-1 py-3 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 ${
              ok ? "bg-stone-900 text-white active:bg-stone-700" : "bg-stone-200 text-stone-400 cursor-not-allowed"
            }`}>
            {saving && <Loader2 size={14} className="animate-spin" />}
            {saving ? "保存中..." : "保存"}
          </button>
        </div>

        {uploadProgress && (
          <p className="text-center text-xs text-stone-400 mt-3 animate-pulse flex items-center justify-center gap-1.5">
            <Loader2 size={12} className="animate-spin" /> {uploadProgress}
          </p>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   Customer Page (fetches product by ID)
   ═══════════════════════════════════════════ */

function CustomerPage({ productId }) {
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetchOne(productId).then((p) => {
      if (p) setProduct(p);
      else setError(true);
      setLoading(false);
    }).catch(() => { setError(true); setLoading(false); });
  }, [productId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen text-stone-400 gap-3">
        <Loader2 size={28} className="animate-spin" />
        <p className="text-sm">加载中...</p>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="flex flex-col items-center justify-center h-screen text-stone-400 gap-3 px-6 text-center">
        <AlertCircle size={36} />
        <p className="text-base font-medium text-stone-600">商品未找到</p>
        <p className="text-sm">该商品可能已下架或链接有误</p>
      </div>
    );
  }

  return <Display product={product} />;
}

/* ═══════════════════════════════════════════
   Admin Page (password + list + form)
   ═══════════════════════════════════════════ */

function AdminPage() {
  const [authed, setAuthed] = useState(!ADMIN_PWD);
  const [pwd, setPwd] = useState("");
  const [pwdErr, setPwdErr] = useState(false);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("list");
  const [editing, setEditing] = useState(null);
  const [previewing, setPreviewing] = useState(null);
  const [qr, setQr] = useState(null);

  // Check session storage for saved auth
  useEffect(() => {
    if (ADMIN_PWD && sessionStorage.getItem("shoe-admin-auth") === "1") {
      setAuthed(true);
    }
  }, []);

  useEffect(() => {
    if (authed) {
      fetchAll()
        .then(setProducts)
        .catch((e) => console.error("Load failed:", e))
        .finally(() => setLoading(false));
    }
  }, [authed]);

  const handleLogin = () => {
    if (pwd === ADMIN_PWD) {
      setAuthed(true);
      sessionStorage.setItem("shoe-admin-auth", "1");
    } else {
      setPwdErr(true);
      setTimeout(() => setPwdErr(false), 2000);
    }
  };

  const reload = async () => {
    const data = await fetchAll();
    setProducts(data);
  };

  /* Password gate */
  if (!authed) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center px-6">
        <div className="bg-white rounded-2xl p-6 max-w-xs w-full shadow-sm text-center">
          <div className="w-12 h-12 rounded-full bg-stone-100 flex items-center justify-center mx-auto mb-4">
            <Lock size={20} className="text-stone-400" />
          </div>
          <h2 className="font-bold text-lg text-stone-900 mb-1">管理后台</h2>
          <p className="text-xs text-stone-400 mb-4">请输入管理密码</p>
          <input
            type="password" value={pwd}
            onChange={(e) => setPwd(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            placeholder="密码"
            className={`w-full px-3 py-2.5 rounded-lg bg-stone-50 border text-sm text-center focus:outline-none ${
              pwdErr ? "border-red-400" : "border-stone-200 focus:border-stone-400"
            }`}
          />
          {pwdErr && <p className="text-xs text-red-500 mt-2">密码错误</p>}
          <button onClick={handleLogin}
            className="w-full mt-3 py-2.5 rounded-lg bg-stone-900 text-white text-sm font-medium active:bg-stone-700">
            进入
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen text-stone-400 gap-2">
        <Loader2 size={20} className="animate-spin" /> 加载中...
      </div>
    );
  }

  /* Preview */
  if (view === "preview") {
    return <Display product={previewing} onBack={() => setView("list")} isPreview />;
  }

  /* Form */
  if (view === "form") {
    return (
      <Form
        init={editing}
        onSave={() => { reload(); setView("list"); setEditing(null); }}
        onCancel={() => { setView("list"); setEditing(null); }}
      />
    );
  }

  /* Product list */
  return (
    <div className="min-h-screen bg-stone-50">
      <div className="max-w-lg mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-stone-900 flex items-center gap-2">
            <Package size={22} /> 商品管理
          </h1>
          <button
            onClick={() => {
              setEditing({ id: uid(), name: "", contact: "", colors: [{ name: "", images: [], sizes: [] }] });
              setView("form");
            }}
            className="bg-stone-900 text-white px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-1.5 active:bg-stone-700 shadow-sm">
            <Plus size={16} /> 添加商品
          </button>
        </div>

        {products.length === 0 && (
          <div className="text-center py-24">
            <div className="w-16 h-16 rounded-2xl bg-stone-100 flex items-center justify-center mx-auto mb-4">
              <Package size={28} className="text-stone-300" />
            </div>
            <p className="text-stone-500 font-medium">还没有商品</p>
            <p className="text-sm text-stone-400 mt-1">点击「添加商品」录入第一个鞋款</p>
          </div>
        )}

        <div className="space-y-3">
          {products.map((p) => {
            const imgCount = p.colors?.reduce((s, c) => s + (c.images?.length || 0), 0) || 0;
            const thumb = p.colors?.[0]?.images?.[0];
            return (
              <div key={p.id} className="bg-white rounded-xl p-4 shadow-sm">
                <div className="flex gap-3">
                  <div className="w-20 h-20 rounded-lg bg-stone-100 flex-shrink-0 overflow-hidden">
                    {thumb
                      ? <img src={thumb} className="w-full h-full object-cover" alt="" />
                      : <div className="w-full h-full flex items-center justify-center text-stone-300"><Camera size={22} /></div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-stone-900 truncate">{p.name || "未命名"}</h3>
                    <p className="text-xs text-stone-400 mt-0.5">
                      {p.colors?.length || 0} 个配色 · {imgCount} 张图
                    </p>
                    <div className="flex flex-wrap gap-1.5 mt-2.5">
                      <button onClick={() => { setPreviewing(p); setView("preview"); }}
                        className="text-xs px-2.5 py-1 rounded-lg bg-stone-100 text-stone-600 flex items-center gap-1 active:bg-stone-200">
                        <Eye size={12} /> 预览
                      </button>
                      <button onClick={() => { setEditing(JSON.parse(JSON.stringify(p))); setView("form"); }}
                        className="text-xs px-2.5 py-1 rounded-lg bg-stone-100 text-stone-600 flex items-center gap-1 active:bg-stone-200">
                        <Edit3 size={12} /> 编辑
                      </button>
                      <button onClick={() => setQr(p)}
                        className="text-xs px-2.5 py-1 rounded-lg bg-stone-100 text-stone-600 flex items-center gap-1 active:bg-stone-200">
                        <Share2 size={12} /> 二维码
                      </button>
                      <button onClick={async () => {
                        if (!confirm("确定删除？图片也会一并删除")) return;
                        try { await removeProduct(p); reload(); }
                        catch (e) { alert("删除失败: " + e.message); }
                      }}
                        className="text-xs px-2.5 py-1 rounded-lg bg-red-50 text-red-500 flex items-center gap-1 active:bg-red-100">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {products.length > 0 && (
          <p className="text-center text-xs text-stone-300 mt-8">
            点击「二维码」生成商品分享码，客户扫码即可查看
          </p>
        )}
      </div>

      {qr && <QRModal product={qr} onClose={() => setQr(null)} />}
    </div>
  );
}

/* ═══════════════════════════════════════════
   Main App — URL Routing
   ═══════════════════════════════════════════ */

export default function App() {
  const [path, setPath] = useState(window.location.pathname);

  useEffect(() => {
    const handler = () => setPath(window.location.pathname);
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, []);

  // Customer route: /p/PRODUCT_ID
  const match = path.match(/^\/p\/(.+)$/);
  if (match) {
    return <CustomerPage productId={match[1]} />;
  }

  // Everything else → Admin
  return <AdminPage />;
}
