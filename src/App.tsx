import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { debounce } from 'lodash';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  Timestamp, 
  orderBy,
  getDocFromServer,
  setDoc
} from 'firebase/firestore';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  User,
  signOut
} from 'firebase/auth';
import { 
  Book, 
  Plus, 
  ChevronRight, 
  Save, 
  Trash2, 
  Wand2, 
  ClipboardCheck, 
  RefreshCw, 
  ArrowLeft, 
  LogOut, 
  FileText, 
  Settings as SettingsIcon,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Globe,
  Users,
  Map,
  GitBranch,
  Box,
  Image as ImageIcon,
  X,
  Cpu,
  Activity,
  Check,
  Search,
  FileSearch,
  Sparkles,
  Upload,
  Eye
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from 'react-resizable-panels';
import { db, auth } from './firebase';
import { Novel, Chapter, UserProfile } from './types';
import { 
  generateChapterContent, 
  auditChapter, 
  reviseChapter, 
  analyzePlatform, 
  generateChapterTitle, 
  optimizeContent, 
  generateCoverImage 
} from './services/geminiService';
import { cn } from './lib/utils';
import { AIConfig, TokenUsage } from './types';

// --- i18n ---
const translations = {
  en: {
    appName: "Novel Creator OS",
    myNovels: "My Novels",
    manageProjects: "Manage your creative projects",
    newNovel: "New Novel",
    noNovels: "No novels yet. Start your first masterpiece!",
    settings: "Settings",
    language: "Language",
    globalRules: "Global Writing Rules",
    globalRulesDesc: "AI will refer to these rules for all your novels.",
    save: "Save",
    cancel: "Cancel",
    chapters: "Chapters",
    outline: "Outline",
    background: "Background",
    characters: "Characters",
    plotlines: "Plotlines",
    items: "Items",
    styleGuide: "Style Guide",
    novelTitle: "Novel Title",
    description: "Description",
    coverImage: "Cover Image URL",
    suggestedSize: "Suggested: 600x800px, < 2MB",
    plotOutline: "Plot Outline",
    write: "Write",
    audit: "AI Audit",
    revise: "Revise",
    finalize: "Finalize",
    auditFeedback: "AI Audit Feedback",
    regenerateFromReview: "Regenerate Based on Review",
    noChapterSelected: "No Chapter Selected",
    selectChapterDesc: "Select a chapter from the sidebar or create a new one to start writing.",
    createChapter: "Create Chapter",
    deleteConfirm: "Are you sure you want to delete this novel?",
    writer: "Writer",
    status: "Status",
    draft: "Draft",
    auditing: "Auditing",
    revised: "Revised",
    final: "Final",
    wordCount: "Word Count",
    worldBuilding: "World Building",
    characterLibrary: "Character Library",
    plotlineLibrary: "Plotline Library",
    itemLibrary: "Item Library",
    edit: "Edit",
    preview: "Preview",
    aiConfig: "AI Model Config",
    tokenUsage: "Token Usage",
    daily: "Daily",
    weekly: "Weekly",
    monthly: "Monthly",
    provider: "Provider",
    displayName: "Display Name",
    apiKey: "API Key",
    baseUrl: "Base URL",
    modelId: "Model ID",
    protocol: "Protocol",
    custom: "Custom",
    addConfig: "Add Config",
    targetPlatform: "Target Platform",
    analyze: "Analyze",
    platformAnalysis: "Platform Analysis",
    autoGenerate: "Auto-generate",
    titleStyle: "Title Style",
    optimize: "Optimize",
    aiOptimize: "AI Optimize",
    aiGenerate: "AI Generate",
    uploadImage: "Upload Image",
    pasteImage: "Paste to upload",
    currentModel: "Current Active Model",
    optimizing: "Optimizing...",
    analyzing: "Analyzing...",
    generating: "Generating...",
    fileTooLarge: "File too large. Max 2MB.",
  },
  zh: {
    appName: "小说创作者OS",
    myNovels: "我的小说",
    manageProjects: "管理您的创作项目",
    newNovel: "新建小说",
    noNovels: "暂无小说。开始您的第一部杰作吧！",
    settings: "配置",
    language: "选择语言",
    globalRules: "小说灵感配置",
    globalRulesDesc: "AI 在创作时会参考这些全局写作规则和要求。",
    save: "保存",
    cancel: "取消",
    chapters: "章节",
    outline: "大纲",
    background: "背景内容库",
    characters: "人物库",
    plotlines: "任务线",
    items: "物品库",
    styleGuide: "文风指南",
    novelTitle: "小说标题",
    description: "简介",
    coverImage: "封面图片 URL",
    suggestedSize: "建议尺寸: 600x800px, 小于 2MB",
    plotOutline: "剧情大纲",
    write: "写作",
    audit: "AI审核",
    revise: "修改",
    finalize: "定稿",
    auditFeedback: "AI 审核反馈",
    regenerateFromReview: "重新生成",
    noChapterSelected: "未选择章节",
    selectChapterDesc: "从侧边栏选择一个章节或创建一个新章节开始写作。",
    createChapter: "创建章节",
    deleteConfirm: "您确定要删除这部小说吗？",
    writer: "创作者",
    status: "状态",
    draft: "草稿",
    auditing: "审核中",
    revised: "已修改",
    final: "已定稿",
    wordCount: "字数",
    worldBuilding: "世界观设定",
    characterLibrary: "人物设定",
    plotlineLibrary: "剧情线设定",
    itemLibrary: "物品设定",
    edit: "编辑",
    preview: "预览",
    aiConfig: "AI大模型配置",
    tokenUsage: "Token消耗量",
    daily: "本日",
    weekly: "本周",
    monthly: "本月",
    provider: "提供商",
    displayName: "显示名称",
    apiKey: "API密钥",
    baseUrl: "基础URL",
    modelId: "模型ID",
    protocol: "协议选择",
    custom: "自定义",
    addConfig: "添加配置",
    targetPlatform: "计划上线平台",
    analyze: "分析平台",
    platformAnalysis: "平台分析报告",
    autoGenerate: "自动生成",
    titleStyle: "标题风格",
    optimize: "优化",
    aiOptimize: "AI 优化",
    aiGenerate: "AI 生成",
    uploadImage: "上传图片",
    pasteImage: "粘贴图片上传",
    currentModel: "当前正在使用的模型",
    optimizing: "优化中...",
    analyzing: "分析中...",
    generating: "生成中...",
    fileTooLarge: "文件太大。最大限制为 2MB。",
  }
};

// --- Error Handling ---
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// --- Components ---

const Button = ({ 
  children, 
  onClick, 
  variant = 'primary', 
  className, 
  disabled, 
  loading 
}: { 
  children: React.ReactNode; 
  onClick?: () => void; 
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline'; 
  className?: string; 
  disabled?: boolean;
  loading?: boolean;
}) => {
  const variants = {
    primary: 'bg-zinc-900 text-white hover:bg-zinc-800',
    secondary: 'bg-zinc-100 text-zinc-900 hover:bg-zinc-200',
    danger: 'bg-red-50 text-red-600 hover:bg-red-100',
    ghost: 'bg-transparent text-zinc-600 hover:bg-zinc-100',
    outline: 'bg-transparent border border-zinc-200 text-zinc-900 hover:bg-zinc-50',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(
        'px-4 py-2 rounded-lg font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed',
        variants[variant],
        className
      )}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : children}
    </button>
  );
};

const Card = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn('bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-sm', className)}>
    {children}
  </div>
);

const Input = ({ label, value, onChange, placeholder, type = 'text', multiline, rows = 6, onOptimize, optimizing }: any) => (
  <div className="space-y-1.5">
    <div className="flex items-center justify-between">
      {label && <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">{label}</label>}
      {onOptimize && (
        <button 
          onClick={onOptimize}
          disabled={optimizing}
          className="text-[10px] font-bold text-zinc-400 hover:text-zinc-900 flex items-center gap-1 transition-colors disabled:opacity-50"
        >
          {optimizing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
          AI Optimize
        </button>
      )}
    </div>
    {multiline ? (
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900/5 transition-all font-mono text-sm leading-relaxed"
      />
    ) : (
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900/5 transition-all text-sm"
      />
    )}
  </div>
);

const ContentLibraryEditor = ({ title, value, onChange, placeholder, t, onOptimize, optimizing }: any) => {
  const [isPreview, setIsPreview] = useState(false);
  const [showInstruction, setShowInstruction] = useState(false);
  const [instruction, setInstruction] = useState('');
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <label className="text-xs font-bold uppercase tracking-widest text-zinc-500">{title}</label>
          {onOptimize && (
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setShowInstruction(!showInstruction)}
                disabled={optimizing}
                className={cn(
                  "text-[10px] font-bold flex items-center gap-1 transition-colors disabled:opacity-50",
                  showInstruction ? "text-zinc-900" : "text-zinc-400 hover:text-zinc-900"
                )}
              >
                {optimizing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                {t.aiOptimize}
              </button>
              {showInstruction && (
                <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2 duration-200">
                  <input 
                    value={instruction}
                    onChange={(e) => setInstruction(e.target.value)}
                    placeholder={t.language === 'zh' ? "输入修改要求 (可选)..." : "Enter requirements (optional)..."}
                    className="text-[10px] px-2 py-1 bg-zinc-100 border border-zinc-200 rounded focus:outline-none focus:ring-1 focus:ring-zinc-900/10 w-48"
                  />
                  <button 
                    onClick={() => {
                      onOptimize(instruction);
                      setInstruction('');
                      setShowInstruction(false);
                    }}
                    disabled={optimizing}
                    className="text-[10px] font-bold text-zinc-900 hover:underline disabled:opacity-50"
                  >
                    {t.autoGenerate}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="flex bg-zinc-100 p-0.5 rounded-lg">
          <button 
            onClick={() => setIsPreview(false)}
            className={cn(
              "px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all",
              !isPreview ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-400 hover:text-zinc-600"
            )}
          >
            {t.edit}
          </button>
          <button 
            onClick={() => setIsPreview(true)}
            className={cn(
              "px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all",
              isPreview ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-400 hover:text-zinc-600"
            )}
          >
            {t.preview}
          </button>
        </div>
      </div>
      
      {isPreview ? (
        <div className="min-h-[400px] p-6 bg-zinc-50 border border-zinc-200 rounded-xl prose prose-sm max-w-none">
          {value ? <ReactMarkdown>{value}</ReactMarkdown> : <p className="text-zinc-400 italic">No content yet.</p>}
        </div>
      ) : (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full min-h-[400px] px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900/5 transition-all font-mono text-sm leading-relaxed resize-none"
        />
      )}
    </div>
  );
};

const Modal = ({ isOpen, onClose, title, children }: any) => (
  <AnimatePresence>
    {isOpen && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          exit={{ opacity: 0 }} 
          onClick={onClose}
          className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm" 
        />
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }} 
          animate={{ opacity: 1, scale: 1, y: 0 }} 
          exit={{ opacity: 0, scale: 0.95, y: 20 }} 
          className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden"
        >
          <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between">
            <h3 className="font-bold text-lg">{title}</h3>
            <button onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-full transition-colors">
              <X className="w-5 h-5 text-zinc-400" />
            </button>
          </div>
          <div className="p-6">
            {children}
          </div>
        </motion.div>
      </div>
    )}
  </AnimatePresence>
);

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [novels, setNovels] = useState<Novel[]>([]);
  const [selectedNovel, setSelectedNovel] = useState<Novel | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);
  const [loading, setLoading] = useState(true);
  const [aiActionLoading, setAiActionLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'chapters' | 'platform' | 'outline' | 'background' | 'characters' | 'plotlines' | 'items'>('chapters');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showAuditInput, setShowAuditInput] = useState(false);
  const [auditInstruction, setAuditInstruction] = useState('');
  const [showReviseInput, setShowReviseInput] = useState(false);
  const [reviseInstruction, setReviseInstruction] = useState('');
  const [showWriteInput, setShowWriteInput] = useState(false);
  const [writeInstruction, setWriteInstruction] = useState('');
  const [showTitleInput, setShowTitleInput] = useState(false);
  const [titleInstruction, setTitleInstruction] = useState('');
  const [showCoverInput, setShowCoverInput] = useState(false);
  const [coverInstruction, setCoverInstruction] = useState('');
  const [showPlatformInput, setShowPlatformInput] = useState(false);
  const [platformInstruction, setPlatformInstruction] = useState('');
  const [showChapterPreview, setShowChapterPreview] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'general' | 'ai' | 'tokens'>('general');
  const [optimizingField, setOptimizingField] = useState<string | null>(null);
  const [analyzingPlatform, setAnalyzingPlatform] = useState(false);
  const [generatingCover, setGeneratingCover] = useState(false);
  const [generatingTitle, setGeneratingTitle] = useState(false);

  const novelUpdateQueue = useRef<Record<string, any>>({});
  const chapterUpdateQueue = useRef<Record<string, any>>({});

  const debouncedSyncNovel = useRef(
    debounce(async (id: string) => {
      const updates = novelUpdateQueue.current[id];
      if (!updates) return;
      delete novelUpdateQueue.current[id];
      try {
        await updateDoc(doc(db, 'novels', id), updates);
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `novels/${id}`);
      }
    }, 1000)
  ).current;

  const debouncedSyncChapter = useRef(
    debounce(async (novelId: string, chapterId: string) => {
      const updates = chapterUpdateQueue.current[chapterId];
      if (!updates) return;
      delete chapterUpdateQueue.current[chapterId];
      try {
        await updateDoc(doc(db, `novels/${novelId}/chapters`, chapterId), updates);
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `novels/${novelId}/chapters/${chapterId}`);
      }
    }, 1000)
  ).current;

  const lang = userProfile?.language || 'zh';
  const t = translations[lang as keyof typeof translations];

  const aiConfigs: AIConfig[] = useMemo(() => {
    if (!userProfile?.aiConfigs) return [];
    try {
      return JSON.parse(userProfile.aiConfigs);
    } catch (e) {
      return [];
    }
  }, [userProfile?.aiConfigs]);

  const tokenUsage: TokenUsage = useMemo(() => {
    const defaultUsage = { daily: 0, weekly: 0, monthly: 0, lastUpdated: new Date().toISOString() };
    if (!userProfile?.tokenUsage) return defaultUsage;
    try {
      return JSON.parse(userProfile.tokenUsage);
    } catch (e) {
      return defaultUsage;
    }
  }, [userProfile?.tokenUsage]);

  // Auth & Profile
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
      if (user) {
        testConnection();
        // Fetch/Init Profile
        const profileRef = doc(db, 'users', user.uid);
        onSnapshot(profileRef, (docSnap) => {
          if (docSnap.exists()) {
            setUserProfile(docSnap.data() as UserProfile);
          } else {
            const initialProfile: UserProfile = {
              uid: user.uid,
              email: user.email || '',
              language: 'zh',
              globalRules: ''
            };
            setDoc(profileRef, initialProfile);
          }
        });
      }
    });
    return () => unsubscribe();
  }, []);

  const testConnection = async () => {
    try {
      await getDocFromServer(doc(db, 'test', 'connection'));
    } catch (error) {
      if (error instanceof Error && error.message.includes('the client is offline')) {
        console.error("Please check your Firebase configuration.");
      }
    }
  };

  const login = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Login failed', error);
    }
  };

  const logout = () => signOut(auth);

  // Fetch Novels
  useEffect(() => {
    if (!user) {
      setNovels([]);
      return;
    }

    const q = query(collection(db, 'novels'), where('authorId', '==', user.uid), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setNovels(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Novel)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'novels'));

    return () => unsubscribe();
  }, [user]);

  // Fetch Chapters
  useEffect(() => {
    if (!selectedNovel) {
      setChapters([]);
      return;
    }

    const q = query(collection(db, `novels/${selectedNovel.id}/chapters`), orderBy('chapterNumber', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setChapters(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Chapter)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, `novels/${selectedNovel.id}/chapters`));

    return () => unsubscribe();
  }, [selectedNovel]);

  // Actions
  const createNovel = async () => {
    if (!user) return;
    try {
      await addDoc(collection(db, 'novels'), {
        title: lang === 'zh' ? '新小说' : 'New Novel',
        description: '',
        coverImage: '',
        outline: '',
        styleGuide: '',
        background: '',
        characters: '',
        plotlines: '',
        items: '',
        targetPlatform: '',
        platformAnalysis: '',
        authorId: user.uid,
        createdAt: Timestamp.now()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'novels');
    }
  };

  const updateNovel = (updates: Partial<Novel>) => {
    if (!selectedNovel) return;
    const { id, ...data } = updates as any;
    novelUpdateQueue.current[selectedNovel.id] = {
      ...(novelUpdateQueue.current[selectedNovel.id] || {}),
      ...data
    };
    setSelectedNovel({ ...selectedNovel, ...updates });
    debouncedSyncNovel(selectedNovel.id);
  };

  const deleteNovel = async (id: string) => {
    if (!window.confirm(t.deleteConfirm)) return;
    try {
      await deleteDoc(doc(db, 'novels', id));
      if (selectedNovel?.id === id) setSelectedNovel(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `novels/${id}`);
    }
  };

  const createChapter = async () => {
    if (!selectedNovel) return;
    const nextNum = chapters.length + 1;
    try {
      const docRef = await addDoc(collection(db, `novels/${selectedNovel.id}/chapters`), {
        novelId: selectedNovel.id,
        chapterNumber: nextNum,
        title: lang === 'zh' ? `第 ${nextNum} 章` : `Chapter ${nextNum}`,
        content: '',
        status: 'draft',
        createdAt: Timestamp.now()
      });
      const newChapter = { 
        id: docRef.id, 
        novelId: selectedNovel.id, 
        chapterNumber: nextNum, 
        title: lang === 'zh' ? `第 ${nextNum} 章` : `Chapter ${nextNum}`, 
        content: '', 
        status: 'draft', 
        createdAt: Timestamp.now() 
      } as Chapter;
      setSelectedChapter(newChapter);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `novels/${selectedNovel.id}/chapters`);
    }
  };

  const updateChapter = (updates: Partial<Chapter>) => {
    if (!selectedNovel || !selectedChapter) return;
    const { id, ...data } = updates as any;
    chapterUpdateQueue.current[selectedChapter.id] = {
      ...(chapterUpdateQueue.current[selectedChapter.id] || {}),
      ...data
    };
    setSelectedChapter({ ...selectedChapter, ...updates });
    debouncedSyncChapter(selectedNovel.id, selectedChapter.id);
  };

  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!user) return;
    try {
      const { uid, ...data } = updates as any;
      await updateDoc(doc(db, 'users', user.uid), data);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  // AI Actions
  const handleAiWrite = async (instruction?: string) => {
    if (!selectedNovel || !selectedChapter) return;
    setAiActionLoading(true);
    try {
      const { content, tokenUsageJson } = await generateChapterContent(
        selectedNovel, 
        chapters.filter(c => c.id !== selectedChapter.id), 
        selectedChapter.chapterNumber,
        userProfile || undefined,
        instruction
      );
      const updates: any = { content, status: 'draft' };
      await updateChapter(updates);
      if (tokenUsageJson) await updateProfile({ tokenUsage: tokenUsageJson });
    } catch (error) {
      console.error('AI Write failed', error);
    } finally {
      setAiActionLoading(false);
    }
  };

  const handleAiAudit = async (instruction?: string) => {
    if (!selectedNovel || !selectedChapter) return;
    setAiActionLoading(true);
    try {
      const { feedback, tokenUsageJson } = await auditChapter(selectedNovel, selectedChapter, userProfile || undefined, instruction);
      const updates: any = { auditFeedback: feedback, status: 'auditing' };
      await updateChapter(updates);
      if (tokenUsageJson) await updateProfile({ tokenUsage: tokenUsageJson });
    } catch (error) {
      console.error('AI Audit failed', error);
    } finally {
      setAiActionLoading(false);
    }
  };

  const handleAiRevise = async (instruction?: string) => {
    if (!selectedNovel || !selectedChapter || !selectedChapter.auditFeedback) return;
    setAiActionLoading(true);
    try {
      const { content, tokenUsageJson } = await reviseChapter(selectedNovel, selectedChapter, selectedChapter.auditFeedback, userProfile || undefined, instruction);
      const updates: any = { content, status: 'revised' };
      await updateChapter(updates);
      if (tokenUsageJson) await updateProfile({ tokenUsage: tokenUsageJson });
    } catch (error) {
      console.error('AI Revise failed', error);
    } finally {
      setAiActionLoading(false);
    }
  };

  const handleAnalyzePlatform = async (instruction?: string) => {
    if (!selectedNovel || !selectedNovel.targetPlatform) return;
    setAnalyzingPlatform(true);
    try {
      const { analysis, tokenUsageJson } = await analyzePlatform(selectedNovel.targetPlatform, userProfile || undefined, instruction);
      await updateNovel({ platformAnalysis: analysis });
      if (tokenUsageJson) await updateProfile({ tokenUsage: tokenUsageJson });
    } catch (error) {
      console.error('Platform analysis failed', error);
    } finally {
      setAnalyzingPlatform(false);
    }
  };

  const handleOptimizeContent = async (field: keyof Novel, type: string, instruction?: string) => {
    if (!selectedNovel) return;
    const currentVal = selectedNovel[field] as string || '';

    setOptimizingField(field);
    try {
      const { optimized, tokenUsageJson } = await optimizeContent(type, currentVal, instruction, userProfile || undefined);
      await updateNovel({ [field]: optimized });
      if (tokenUsageJson) await updateProfile({ tokenUsage: tokenUsageJson });
    } catch (error) {
      console.error('Optimization failed', error);
    } finally {
      setOptimizingField(null);
    }
  };

  const handleGenerateTitle = async (instruction?: string) => {
    if (!selectedNovel || !selectedChapter || !selectedChapter.content) return;
    
    setGeneratingTitle(true);
    try {
      const { title, tokenUsageJson } = await generateChapterTitle(selectedChapter.content, instruction, userProfile || undefined);
      await updateChapter({ title });
      if (tokenUsageJson) await updateProfile({ tokenUsage: tokenUsageJson });
    } catch (error) {
      console.error('Title generation failed', error);
    } finally {
      setGeneratingTitle(false);
    }
  };

  const compressImage = (base64Str: string, maxWidth = 600, maxHeight = 800, quality = 0.7): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height *= maxWidth / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width *= maxHeight / height;
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => resolve(base64Str);
    });
  };

  const handleGenerateCover = async (instruction?: string) => {
    if (!selectedNovel) return;
    setGeneratingCover(true);
    try {
      const imageUrl = await generateCoverImage(selectedNovel.title, selectedNovel.description || "", instruction);
      if (imageUrl) {
        const compressed = await compressImage(imageUrl);
        await updateNovel({ coverImage: compressed });
      }
    } catch (error) {
      console.error('Cover generation failed', error);
    } finally {
      setGeneratingCover(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert(t.fileTooLarge);
      return;
    }
    const reader = new FileReader();
    reader.onloadend = async () => {
      const compressed = await compressImage(reader.result as string);
      updateNovel({ coverImage: compressed });
    };
    reader.readAsDataURL(file);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        const blob = items[i].getAsFile();
        if (!blob) continue;
        if (blob.size > 2 * 1024 * 1024) {
          alert(t.fileTooLarge);
          continue;
        }
        const reader = new FileReader();
        reader.onloadend = async () => {
          const compressed = await compressImage(reader.result as string);
          updateNovel({ coverImage: compressed });
        };
        reader.readAsDataURL(blob);
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 bg-zinc-900 rounded-2xl flex items-center justify-center mb-6 shadow-xl">
          <Book className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-zinc-900 mb-2">小说创作者OS</h1>
        <p className="text-zinc-500 mb-8 max-w-sm">
          Autonomous novel writing assistant. AI agents write, audit, and revise your stories.
        </p>
        <Button onClick={login} className="w-full max-w-xs">
          Sign in with Google
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 font-sans">
      {/* Header */}
      <header className="h-16 bg-white border-b border-zinc-200 flex items-center justify-between px-6 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-zinc-900 rounded-lg flex items-center justify-center">
            <Book className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold tracking-tight">{t.appName}</span>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setIsSettingsOpen(true)}
            className="p-2 text-zinc-400 hover:text-zinc-900 transition-colors"
          >
            <SettingsIcon className="w-5 h-5" />
          </button>
          <div className="w-px h-6 bg-zinc-200" />
          <div className="flex flex-col items-end">
            <span className="text-xs font-medium text-zinc-900">{user.displayName}</span>
            <span className="text-[10px] text-zinc-400 uppercase tracking-wider font-bold">{t.writer}</span>
          </div>
          <button onClick={logout} className="p-2 text-zinc-400 hover:text-zinc-900 transition-colors">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6">
        {!selectedNovel ? (
          <div className="space-y-8">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">{t.myNovels}</h2>
                <p className="text-zinc-500 text-sm">{t.manageProjects}</p>
              </div>
              <Button onClick={createNovel}>
                <Plus className="w-4 h-4" /> {t.newNovel}
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {novels.map((novel) => (
                <motion.div
                  key={novel.id}
                  layoutId={novel.id}
                  onClick={() => setSelectedNovel(novel)}
                  className="group cursor-pointer"
                >
                  <Card className="h-full p-0 hover:border-zinc-400 transition-all flex flex-col">
                    <div className="aspect-[16/9] bg-zinc-100 relative overflow-hidden">
                      {novel.coverImage ? (
                        <img 
                          src={novel.coverImage} 
                          alt={novel.title} 
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-zinc-300">
                          <ImageIcon className="w-12 h-12" />
                        </div>
                      )}
                      <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={(e) => { e.stopPropagation(); deleteNovel(novel.id); }}
                          className="p-2 bg-white/90 backdrop-blur rounded-lg text-red-500 shadow-sm hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div className="p-6 flex-1 flex flex-col">
                      <h3 className="font-bold text-lg mb-1">{novel.title}</h3>
                      <p className="text-zinc-500 text-sm line-clamp-2 mb-4 flex-1">
                        {novel.description || '...'}
                      </p>
                      <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-widest text-zinc-400 mt-auto">
                        <span>{novel.createdAt.toDate().toLocaleDateString()}</span>
                        <span className="w-1 h-1 bg-zinc-200 rounded-full" />
                        <span>{novel.authorId.slice(0, 6)}</span>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))}
              {novels.length === 0 && (
                <div className="col-span-full py-20 text-center border-2 border-dashed border-zinc-200 rounded-2xl">
                  <p className="text-zinc-400">{t.noNovels}</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Novel Editor Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => { setSelectedNovel(null); setSelectedChapter(null); }}
                  className="p-2 hover:bg-zinc-100 rounded-lg transition-colors"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                  <h2 className="text-xl font-bold">{selectedNovel.title}</h2>
                  <div className="flex items-center gap-3 mt-2 overflow-x-auto no-scrollbar pb-2">
                    {[
                      { id: 'chapters', label: t.chapters, icon: FileText },
                      { id: 'platform', label: t.targetPlatform, icon: Globe },
                      { id: 'outline', label: t.outline, icon: GitBranch },
                      { id: 'background', label: t.background, icon: Map },
                      { id: 'characters', label: t.characters, icon: Users },
                      { id: 'plotlines', label: t.plotlines, icon: GitBranch },
                      { id: 'items', label: t.items, icon: Box },
                    ].map((tab) => (
                      <button 
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={cn(
                          "flex items-center gap-2 px-5 py-2.5 rounded-2xl text-base font-semibold transition-all whitespace-nowrap backdrop-blur-xl border",
                          activeTab === tab.id 
                            ? "bg-white/90 border-white/50 text-zinc-900 shadow-lg shadow-black/5" 
                            : "bg-white/40 border-white/20 text-zinc-600 hover:bg-white/60 hover:text-zinc-900 hover:shadow-md"
                        )}
                      >
                        <tab.icon className="w-5 h-5" />
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => updateNovel(selectedNovel)}>
                  <Save className="w-4 h-4" /> {t.save}
                </Button>
              </div>
            </div>

            {activeTab === 'chapters' && (
              <PanelGroup orientation="horizontal" className="min-h-[800px] items-stretch">
                {/* Chapters Sidebar */}
                <Panel defaultSize={20} minSize={5} className="pr-4 flex flex-col">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between px-2 gap-2 min-w-0">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 truncate">{t.chapters}</span>
                      <button onClick={createChapter} className="p-1 hover:bg-zinc-200 rounded transition-colors flex-shrink-0">
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="space-y-1">
                      {chapters.map((chapter) => (
                        <button
                          key={chapter.id}
                          onClick={() => setSelectedChapter(chapter)}
                          className={cn(
                            "w-full text-left px-3 py-2 rounded-lg text-sm transition-all flex items-center justify-between group gap-2 min-w-0",
                            selectedChapter?.id === chapter.id ? "bg-zinc-900 text-white" : "hover:bg-zinc-100 text-zinc-600"
                          )}
                        >
                          <span className="truncate flex-1">{chapter.title || `Chapter ${chapter.chapterNumber}`}</span>
                          {chapter.status === 'final' && <CheckCircle2 className="w-3 h-3 text-emerald-500 flex-shrink-0" />}
                        </button>
                      ))}
                    </div>
                  </div>
                </Panel>

                <PanelResizeHandle className="w-2 bg-zinc-200/80 hover:bg-zinc-400 active:bg-zinc-500 cursor-col-resize rounded-full transition-colors mx-2 flex items-center justify-center group">
                  <div className="w-1 h-8 bg-zinc-400/50 rounded-full group-hover:bg-white transition-colors" />
                </PanelResizeHandle>

                {/* Chapter Editor */}
                <Panel minSize={10} className="flex flex-col pl-2">
                  {selectedChapter ? (
                    <PanelGroup orientation="horizontal" className="items-stretch">
                      <Panel minSize={10} className="flex flex-col pr-2">
                        <Card className="p-0 w-full flex-1 flex flex-col h-full">
                          <div className="border-b border-zinc-100 p-4 flex flex-wrap items-center justify-between bg-zinc-50/50 gap-4 min-w-0">
                            <div className="flex items-center gap-4 flex-1 min-w-0">
                              <input 
                                value={selectedChapter.title || ''} 
                                onChange={(e) => updateChapter({ title: e.target.value })}
                                className="bg-transparent font-bold text-lg focus:outline-none w-full min-w-0"
                                placeholder={t.novelTitle}
                              />
                              <div className="flex items-center gap-1">
                                <button 
                                  onClick={() => setShowTitleInput(!showTitleInput)}
                                  disabled={generatingTitle || !selectedChapter.content}
                                  className={cn(
                                    "p-1.5 hover:bg-zinc-200 rounded-lg text-zinc-400 hover:text-zinc-900 transition-colors disabled:opacity-30",
                                    showTitleInput && "bg-zinc-100 text-zinc-900"
                                  )}
                                  title={t.autoGenerate}
                                >
                                  {generatingTitle ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                                </button>
                                {showTitleInput && (
                                  <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-2 duration-200">
                                    <input 
                                      value={titleInstruction}
                                      onChange={(e) => setTitleInstruction(e.target.value)}
                                      placeholder={t.language === 'zh' ? "输入标题风格 (可选)..." : "Enter style (optional)..."}
                                      className="text-[10px] px-2 py-1 bg-zinc-50 border border-zinc-200 rounded focus:outline-none focus:ring-2 focus:ring-zinc-900/5 w-32"
                                    />
                                    <button 
                                      onClick={() => {
                                        handleGenerateTitle(titleInstruction);
                                        setTitleInstruction('');
                                        setShowTitleInput(false);
                                      }}
                                      className="text-[10px] font-bold text-zinc-900 hover:underline"
                                    >
                                      {t.autoGenerate}
                                    </button>
                                  </div>
                                )}
                              </div>
                              <div className={cn(
                                "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest",
                                selectedChapter.status === 'final' ? "bg-emerald-100 text-emerald-700" : "bg-zinc-200 text-zinc-600"
                              )}>
                                {t[selectedChapter.status as keyof typeof translations.zh]}
                              </div>
                            </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="flex flex-wrap items-center gap-1">
                              <Button 
                                variant="ghost" 
                                onClick={() => setShowWriteInput(!showWriteInput)} 
                                loading={aiActionLoading}
                                className={cn("text-zinc-600", showWriteInput && "bg-zinc-100")}
                              >
                                <Wand2 className="w-4 h-4" /> {t.write}
                              </Button>
                              {showWriteInput && (
                                <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-2 duration-200">
                                  <input 
                                    value={writeInstruction}
                                    onChange={(e) => setWriteInstruction(e.target.value)}
                                    placeholder={t.language === 'zh' ? "输入写作要求 (可选)..." : "Enter requirements (optional)..."}
                                    className="text-xs px-3 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900/5 w-48"
                                  />
                                  <button 
                                    onClick={() => {
                                      handleAiWrite(writeInstruction);
                                      setWriteInstruction('');
                                      setShowWriteInput(false);
                                    }}
                                    className="text-xs font-bold text-zinc-900 hover:underline"
                                  >
                                    {t.autoGenerate}
                                  </button>
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-1">
                              <Button 
                                variant="ghost" 
                                onClick={() => setShowAuditInput(!showAuditInput)} 
                                loading={aiActionLoading}
                                className={cn("text-zinc-600", showAuditInput && "bg-zinc-100")}
                              >
                                <ClipboardCheck className="w-4 h-4" /> {t.audit}
                              </Button>
                              {showAuditInput && (
                                <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-2 duration-200">
                                  <input 
                                    value={auditInstruction}
                                    onChange={(e) => setAuditInstruction(e.target.value)}
                                    placeholder={t.language === 'zh' ? "输入审核重点 (可选)..." : "Enter focus (optional)..."}
                                    className="text-xs px-3 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900/5 w-48"
                                  />
                                  <button 
                                    onClick={() => {
                                      handleAiAudit(auditInstruction);
                                      setAuditInstruction('');
                                      setShowAuditInput(false);
                                    }}
                                    className="text-xs font-bold text-zinc-900 hover:underline"
                                  >
                                    {t.autoGenerate}
                                  </button>
                                </div>
                              )}
                            </div>

                            {selectedChapter.auditFeedback && (
                              <div className="flex items-center gap-1">
                                <Button 
                                  variant="ghost" 
                                  onClick={() => setShowReviseInput(!showReviseInput)} 
                                  loading={aiActionLoading}
                                  className={cn("text-zinc-600", showReviseInput && "bg-zinc-100")}
                                >
                                  <RefreshCw className="w-4 h-4" /> {t.revise}
                                </Button>
                                {showReviseInput && (
                                  <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-2 duration-200">
                                    <input 
                                      value={reviseInstruction}
                                      onChange={(e) => setReviseInstruction(e.target.value)}
                                      placeholder={t.language === 'zh' ? "输入修改要求 (可选)..." : "Enter requirements (optional)..."}
                                      className="text-xs px-3 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900/5 w-48"
                                    />
                                    <button 
                                      onClick={() => {
                                        handleAiRevise(reviseInstruction);
                                        setReviseInstruction('');
                                        setShowReviseInput(false);
                                      }}
                                      className="text-xs font-bold text-zinc-900 hover:underline"
                                    >
                                      {t.autoGenerate}
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                            <div className="w-px h-6 bg-zinc-200 mx-2" />
                            <Button 
                              variant="primary" 
                              onClick={() => updateChapter({ status: 'final' })}
                              disabled={selectedChapter.status === 'final'}
                            >
                              {t.finalize}
                            </Button>
                          </div>
                        </div>
                        <div className="p-8 flex-1 flex flex-col">
                          {showChapterPreview ? (
                            <div className="w-full flex-1 overflow-y-auto prose prose-zinc prose-lg max-w-none font-serif">
                              <ReactMarkdown>{selectedChapter.content || ''}</ReactMarkdown>
                            </div>
                          ) : (
                            <textarea
                              value={selectedChapter.content || ''}
                              onChange={(e) => updateChapter({ content: e.target.value })}
                              placeholder="..."
                              className="w-full flex-1 focus:outline-none resize-none text-lg leading-relaxed font-serif"
                            />
                          )}
                          <div className="mt-4 pt-4 border-t border-zinc-100 flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                            <span>{t.wordCount}</span>
                            <span className="text-zinc-900">{(selectedChapter.content || '').length}</span>
                          </div>
                        </div>
                      </Card>
                      </Panel>

                      {selectedChapter.auditFeedback && (
                        <>
                          <PanelResizeHandle className="w-2 bg-zinc-200/80 hover:bg-zinc-400 active:bg-zinc-500 cursor-col-resize rounded-full transition-colors mx-2 flex items-center justify-center group">
                            <div className="w-1 h-8 bg-zinc-400/50 rounded-full group-hover:bg-white transition-colors" />
                          </PanelResizeHandle>
                          <Panel defaultSize={30} minSize={5} className="flex flex-col pl-2">
                            <Card className="bg-amber-50/30 border-amber-100 p-6 w-full h-full flex flex-col min-w-0">
                              <div className="flex items-center gap-2 mb-4 text-amber-700 min-w-0">
                                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                <span className="text-xs font-bold uppercase tracking-widest truncate">{t.auditFeedback}</span>
                              </div>
                              <div className="space-y-4 flex-1 flex flex-col min-w-0">
                                <textarea
                                  value={selectedChapter.auditFeedback || ''}
                                  onChange={(e) => updateChapter({ auditFeedback: e.target.value })}
                                  className="w-full flex-1 p-4 bg-white/50 border border-amber-200 rounded-xl text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-amber-500/20 transition-all resize-none min-w-0"
                                  placeholder={t.auditFeedback}
                                />
                                <div className="flex flex-col gap-2 min-w-0">
                                  <Button 
                                    variant="outline" 
                                    onClick={() => handleAiRevise()}
                                    disabled={aiActionLoading || !selectedChapter.auditFeedback}
                                    className="bg-white border-amber-200 text-amber-700 hover:bg-amber-50 w-full flex items-center justify-center gap-2 min-w-0"
                                  >
                                    {aiActionLoading ? <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" /> : <RefreshCw className="w-4 h-4 flex-shrink-0" />}
                                    <span className="truncate">{t.regenerateFromReview}</span>
                                  </Button>
                                  <Button 
                                    variant="outline" 
                                    onClick={() => setShowChapterPreview(!showChapterPreview)}
                                    className="bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-50 w-full flex items-center justify-center gap-2 min-w-0"
                                  >
                                    {showChapterPreview ? <FileText className="w-4 h-4 flex-shrink-0" /> : <Eye className="w-4 h-4 flex-shrink-0" />}
                                    <span className="truncate">{showChapterPreview ? t.edit : t.preview}</span>
                                  </Button>
                                </div>
                              </div>
                            </Card>
                          </Panel>
                        </>
                      )}
                    </PanelGroup>
                  ) : (
                    <div className="h-[600px] flex flex-col items-center justify-center text-center border-2 border-dashed border-zinc-200 rounded-2xl">
                      <div className="p-4 bg-zinc-100 rounded-2xl mb-4">
                        <FileText className="w-8 h-8 text-zinc-400" />
                      </div>
                      <h3 className="font-bold text-lg">{t.noChapterSelected}</h3>
                      <p className="text-zinc-400 text-sm max-w-xs mt-1">
                        {t.selectChapterDesc}
                      </p>
                      <Button variant="outline" onClick={createChapter} className="mt-6">
                        <Plus className="w-4 h-4" /> {t.createChapter}
                      </Button>
                    </div>
                  )}
                </Panel>
              </PanelGroup>
            )}
            {activeTab === 'platform' && (
              <Card className="p-8 space-y-8">
                <div className="max-w-4xl mx-auto space-y-8">
                  <div className="space-y-2">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                      <Globe className="w-5 h-5" /> {t.targetPlatform}
                    </h3>
                    <p className="text-sm text-zinc-500">
                      {t.language === 'zh' ? '分析您的目标发布平台，获取针对性的写作建议和市场洞察。' : 'Analyze your target publishing platform to get specific writing suggestions and market insights.'}
                    </p>
                  </div>

                  <div className="space-y-4 p-6 bg-zinc-50 rounded-2xl border border-zinc-100">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">{t.targetPlatform}</label>
                      <div className="flex items-center gap-2">
                        {showPlatformInput && (
                          <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-2 duration-200">
                            <input 
                              value={platformInstruction}
                              onChange={(e) => setPlatformInstruction(e.target.value)}
                              placeholder={t.language === 'zh' ? "输入分析重点 (可选)..." : "Enter focus (optional)..."}
                              className="text-xs px-3 py-1.5 bg-white border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900/5 w-48"
                            />
                          </div>
                        )}
                        <button 
                          onClick={() => {
                            if (!showPlatformInput) {
                              setShowPlatformInput(true);
                            } else {
                              handleAnalyzePlatform(platformInstruction);
                              setPlatformInstruction('');
                              setShowPlatformInput(false);
                            }
                          }}
                          disabled={analyzingPlatform || !selectedNovel.targetPlatform}
                          className="px-4 py-2 bg-zinc-900 text-white rounded-lg text-xs font-bold hover:bg-zinc-800 transition-colors disabled:opacity-30 flex items-center gap-2"
                        >
                          {analyzingPlatform ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
                          {showPlatformInput ? t.analyze : t.analyze}
                        </button>
                      </div>
                    </div>
                    <input 
                      value={selectedNovel.targetPlatform || ''}
                      onChange={(e) => updateNovel({ targetPlatform: e.target.value })}
                      placeholder="e.g. 起点中文网, WebNovel, Amazon KDP"
                      className="w-full px-4 py-3 bg-white border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900/5 transition-all text-sm"
                    />
                  </div>

                  {selectedNovel.platformAnalysis && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-sm font-bold text-zinc-900">
                        <FileSearch className="w-4 h-4" /> {t.platformAnalysis}
                      </div>
                      <div className="p-8 bg-white rounded-2xl border border-zinc-200 prose prose-zinc prose-sm max-w-none shadow-sm">
                        <ReactMarkdown>{selectedNovel.platformAnalysis}</ReactMarkdown>
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            )}

            {activeTab !== 'chapters' && activeTab !== 'platform' && (
              <Card className="p-8 space-y-8">
                {activeTab === 'outline' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                <div className="lg:col-span-4 space-y-8">
                  <div className="space-y-4">
                    <div className="flex justify-between items-end">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">{t.coverImage}</label>
                      <span className="text-[9px] text-zinc-400 font-medium">{t.suggestedSize}</span>
                    </div>
                    <div className="aspect-[3/4] bg-zinc-100 rounded-2xl overflow-hidden border border-zinc-200 relative group">
                      {selectedNovel.coverImage ? (
                        <img 
                          src={selectedNovel.coverImage} 
                          alt="Cover" 
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-zinc-300">
                          {generatingCover ? <Loader2 className="w-8 h-8 animate-spin" /> : <ImageIcon className="w-12 h-12" />}
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-4">
                        <div className="w-full space-y-2">
                          {showCoverInput && (
                            <input 
                              value={coverInstruction}
                              onChange={(e) => setCoverInstruction(e.target.value)}
                              placeholder={t.language === 'zh' ? "输入封面要求 (可选)..." : "Enter requirements (optional)..."}
                              className="w-full text-[10px] px-2 py-1.5 bg-white/90 border border-white/20 rounded focus:outline-none focus:ring-2 focus:ring-white/50"
                              onClick={(e) => e.stopPropagation()}
                            />
                          )}
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!showCoverInput) {
                                setShowCoverInput(true);
                              } else {
                                handleGenerateCover(coverInstruction);
                                setCoverInstruction('');
                                setShowCoverInput(false);
                              }
                            }}
                            disabled={generatingCover}
                            className="w-full py-2 bg-white text-zinc-900 rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-zinc-100 transition-colors disabled:opacity-50"
                          >
                            <Sparkles className="w-3 h-3" /> {showCoverInput ? t.aiGenerate : t.aiGenerate}
                          </button>
                        </div>
                        <label className="w-full py-2 bg-white/20 backdrop-blur text-white rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-white/30 transition-colors cursor-pointer">
                          <Upload className="w-3 h-3" /> {t.uploadImage}
                          <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                        </label>
                        <div className="text-[8px] text-white/60 font-medium">{t.pasteImage}</div>
                      </div>
                    </div>
                    <input 
                      type="text"
                      placeholder="https://..."
                      value={selectedNovel.coverImage || ''} 
                      onChange={(e) => updateNovel({ coverImage: e.target.value })} 
                      onPaste={handlePaste}
                      className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900/5 transition-all text-xs"
                    />
                  </div>
                  
                  <Input 
                    label={t.novelTitle} 
                    value={selectedNovel.title} 
                    onChange={(val: string) => updateNovel({ title: val })} 
                  />
                  
                  <Input 
                    label={t.description} 
                    multiline 
                    rows={4}
                    value={selectedNovel.description || ''} 
                    onChange={(val: string) => updateNovel({ description: val })} 
                    onOptimize={() => handleOptimizeContent('description', 'Novel Description')}
                    optimizing={optimizingField === 'description'}
                  />
                </div>
                
                <div className="lg:col-span-8 space-y-8">
                  <ContentLibraryEditor 
                    title={t.styleGuide}
                    value={selectedNovel.styleGuide || ''}
                    onChange={(val: string) => updateNovel({ styleGuide: val })}
                    placeholder="..."
                    t={t}
                    onOptimize={() => handleOptimizeContent('styleGuide', 'Style Guide')}
                    optimizing={optimizingField === 'styleGuide'}
                  />
                  <ContentLibraryEditor 
                    title={t.plotOutline}
                    value={selectedNovel.outline || ''}
                    onChange={(val: string) => updateNovel({ outline: val })}
                    placeholder="..."
                    t={t}
                    onOptimize={() => handleOptimizeContent('outline', 'Plot Outline')}
                    optimizing={optimizingField === 'outline'}
                  />
                </div>
              </div>
            )}
            {activeTab === 'background' && (
              <ContentLibraryEditor 
                title={t.worldBuilding}
                value={selectedNovel.background || ''}
                onChange={(val: string) => updateNovel({ background: val })}
                placeholder="..."
                t={t}
                onOptimize={() => handleOptimizeContent('background', 'World Background')}
                optimizing={optimizingField === 'background'}
              />
            )}
            {activeTab === 'characters' && (
              <ContentLibraryEditor 
                title={t.characterLibrary}
                value={selectedNovel.characters || ''}
                onChange={(val: string) => updateNovel({ characters: val })}
                placeholder="..."
                t={t}
                onOptimize={() => handleOptimizeContent('characters', 'Character Library')}
                optimizing={optimizingField === 'characters'}
              />
            )}
            {activeTab === 'plotlines' && (
              <ContentLibraryEditor 
                title={t.plotlineLibrary}
                value={selectedNovel.plotlines || ''}
                onChange={(val: string) => updateNovel({ plotlines: val })}
                placeholder="..."
                t={t}
                onOptimize={() => handleOptimizeContent('plotlines', 'Plotline Library')}
                optimizing={optimizingField === 'plotlines'}
              />
            )}
            {activeTab === 'items' && (
              <ContentLibraryEditor 
                title={t.itemLibrary}
                value={selectedNovel.items || ''}
                onChange={(val: string) => updateNovel({ items: val })}
                placeholder="..."
                t={t}
                onOptimize={() => handleOptimizeContent('items', 'Item Library')}
                optimizing={optimizingField === 'items'}
              />
            )}
              </Card>
            )}
          </div>
        )}
      </main>

      {/* Settings Modal */}
      <Modal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        title={t.settings}
      >
        <div className="space-y-6">
          <div className="flex bg-zinc-100 p-1 rounded-xl">
            {[
              { id: 'general', label: t.settings, icon: Globe },
              { id: 'ai', label: t.aiConfig, icon: Cpu },
              { id: 'tokens', label: t.tokenUsage, icon: Activity },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSettingsTab(tab.id as any)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all",
                  settingsTab === tab.id ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-400 hover:text-zinc-600"
                )}
              >
                <tab.icon className="w-3 h-3" />
                {tab.label}
              </button>
            ))}
          </div>

          {settingsTab === 'general' && (
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-2">
                  <Globe className="w-3 h-3" /> {t.language}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button 
                    onClick={() => updateProfile({ language: 'zh' })}
                    className={cn(
                      "px-4 py-2 rounded-lg border text-sm font-medium transition-all",
                      lang === 'zh' ? "bg-zinc-900 text-white border-zinc-900" : "bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300"
                    )}
                  >
                    中文
                  </button>
                  <button 
                    onClick={() => updateProfile({ language: 'en' })}
                    className={cn(
                      "px-4 py-2 rounded-lg border text-sm font-medium transition-all",
                      lang === 'en' ? "bg-zinc-900 text-white border-zinc-900" : "bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300"
                    )}
                  >
                    English
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-2">
                  <Wand2 className="w-3 h-3" /> {t.globalRules}
                </label>
                <p className="text-[10px] text-zinc-400">{t.globalRulesDesc}</p>
                <textarea
                  value={userProfile?.globalRules || ''}
                  onChange={(e) => updateProfile({ globalRules: e.target.value })}
                  placeholder="..."
                  rows={8}
                  className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900/5 transition-all font-mono text-sm"
                />
              </div>
            </div>
          )}

          {settingsTab === 'ai' && (
            <div className="space-y-6 max-h-[400px] overflow-y-auto pr-2 no-scrollbar">
              {/* Current Active Model Display Box */}
              <div className="p-4 bg-zinc-900 rounded-2xl text-white shadow-xl shadow-zinc-900/20">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-1.5 bg-white/10 rounded-lg">
                    <Cpu className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-white/50">{t.currentModel}</span>
                </div>
                {aiConfigs.find(c => c.isDefault) ? (
                  <div className="space-y-2">
                    <div className="text-lg font-bold">{aiConfigs.find(c => c.isDefault)?.name}</div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-[8px] font-bold uppercase tracking-widest text-white/30 mb-0.5">{t.modelId}</div>
                        <div className="text-xs font-mono truncate">{aiConfigs.find(c => c.isDefault)?.modelId}</div>
                      </div>
                      <div>
                        <div className="text-[8px] font-bold uppercase tracking-widest text-white/30 mb-0.5">{t.protocol}</div>
                        <div className="text-xs font-mono">{aiConfigs.find(c => c.isDefault)?.protocol}</div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="text-lg font-bold">Gemini 3.1 Pro (System Default)</div>
                    <div className="text-xs text-white/50">Using platform-provided AI capabilities.</div>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                {aiConfigs.map((config) => (
                  <div key={config.id} className="p-3 border border-zinc-100 rounded-xl flex items-center justify-between group">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-zinc-900">{config.name}</span>
                        {config.isDefault && <span className="text-[8px] px-1 py-0.5 bg-zinc-900 text-white rounded uppercase font-bold">Default</span>}
                      </div>
                      <div className="text-[10px] text-zinc-400 font-mono">{config.modelId}</div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {!config.isDefault && (
                        <button 
                          onClick={() => {
                            const newConfigs = aiConfigs.map(c => ({ ...c, isDefault: c.id === config.id }));
                            updateProfile({ aiConfigs: JSON.stringify(newConfigs) });
                          }} 
                          className="p-1.5 hover:bg-zinc-100 rounded-lg text-zinc-400 hover:text-zinc-900 transition-colors"
                        >
                          <Check className="w-3 h-3" />
                        </button>
                      )}
                      <button 
                        onClick={() => {
                          const newConfigs = aiConfigs.filter(c => c.id !== config.id);
                          updateProfile({ aiConfigs: JSON.stringify(newConfigs) });
                        }} 
                        className="p-1.5 hover:bg-red-50 rounded-lg text-zinc-400 hover:text-red-600 transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-4 bg-zinc-50 rounded-xl space-y-3">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">{t.addConfig}</h3>
                <div className="grid grid-cols-2 gap-3">
                  <Input label={t.displayName} placeholder="My GPT-4" onChange={(v: string) => {}} />
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">{t.protocol}</label>
                    <select className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-lg text-sm focus:outline-none">
                      <option value="openai-responses">OpenAI Responses</option>
                      <option value="openai-completions">OpenAI Completions</option>
                      <option value="anthropic">Anthropic</option>
                    </select>
                  </div>
                  <Input label={t.apiKey} type="password" placeholder="sk-..." onChange={(v: string) => {}} />
                  <Input label={t.modelId} placeholder="gpt-4o" onChange={(v: string) => {}} />
                  <div className="col-span-2">
                    <Input label={t.baseUrl} placeholder="https://api.openai.com/v1" onChange={(v: string) => {}} />
                  </div>
                </div>
                <Button className="w-full py-2 h-auto text-xs" onClick={() => {
                  // Simplified add for now, in a real app we'd use state for these inputs
                  const name = (document.querySelector('input[placeholder="My GPT-4"]') as HTMLInputElement)?.value;
                  const apiKey = (document.querySelector('input[placeholder="sk-..."]') as HTMLInputElement)?.value;
                  const modelId = (document.querySelector('input[placeholder="gpt-4o"]') as HTMLInputElement)?.value;
                  const baseUrl = (document.querySelector('input[placeholder="https://api.openai.com/v1"]') as HTMLInputElement)?.value;
                  const protocol = (document.querySelector('select') as HTMLSelectElement)?.value;
                  
                  if (name && apiKey) {
                    const newConfig: AIConfig = {
                      id: Math.random().toString(36).substr(2, 9),
                      name, apiKey, modelId: modelId || '', baseUrl: baseUrl || '', protocol: protocol as any,
                      isDefault: aiConfigs.length === 0
                    };
                    updateProfile({ aiConfigs: JSON.stringify([...aiConfigs, newConfig]) });
                  }
                }}>
                  {t.addConfig}
                </Button>
              </div>
            </div>
          )}

          {settingsTab === 'tokens' && (
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: t.daily, value: tokenUsage.daily },
                { label: t.weekly, value: tokenUsage.weekly },
                { label: t.monthly, value: tokenUsage.monthly },
              ].map((stat) => (
                <div key={stat.label} className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100 text-center">
                  <div className="text-[8px] font-bold uppercase tracking-widest text-zinc-400 mb-1">{stat.label}</div>
                  <div className="text-lg font-bold text-zinc-900">{stat.value.toLocaleString()}</div>
                  <div className="text-[8px] text-zinc-400 font-mono mt-1">tokens</div>
                </div>
              ))}
            </div>
          )}

          <div className="pt-4">
            <Button onClick={() => setIsSettingsOpen(false)} className="w-full">
              {t.save}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
