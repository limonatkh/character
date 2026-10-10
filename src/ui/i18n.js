/* Interface strings. Arabic is the default (like Limonat); English via the toggle.
 * Asset names come from each asset's own label { en, ar } in the registry. */
const S = {
  appTitle: { ar: 'صانع شخصيات ليمونات', en: 'Limonat Character Creator' },
  appSub: { ar: 'شخصيات مكعّبات من أوامر الذكاء الاصطناعي', en: 'Voxel characters from AI commands' },
  undo: { ar: 'تراجع', en: 'Undo' }, redo: { ar: 'إعادة', en: 'Redo' },
  lang: { ar: 'EN', en: 'ع' }, langLabel: { ar: 'English', en: 'العربية' },
  name: { ar: 'اسم الشخصية', en: 'Character name' },
  unsaved: { ar: 'غير محفوظة', en: 'Unsaved' }, savedChip: { ar: 'محفوظة', en: 'Saved' }, newChip: { ar: 'جديدة', en: 'New' },

  tabCustomize: { ar: 'تخصيص', en: 'Customize' },
  tabAi: { ar: 'أوامر AI', en: 'AI import' },
  tabPrompt: { ar: 'البرومبت', en: 'AI prompt' },
  tabChars: { ar: 'شخصياتي', en: 'Characters' },
  tabExport: { ar: 'تصدير', en: 'Export' },

  // viewer
  vFront: { ar: 'أمام', en: 'Front' }, vSide: { ar: 'جانب', en: 'Side' }, vBack: { ar: 'خلف', en: 'Back' },
  v34: { ar: '¾', en: '¾' }, vFace: { ar: 'وجه', en: 'Face' },
  pRest: { ar: 'ثابت', en: 'Still' }, pIdle: { ar: 'تنفّس', en: 'Idle' }, pWalk: { ar: 'مشي', en: 'Walk' }, pWave: { ar: 'تلويح', en: 'Wave' }, pT: { ar: 'T', en: 'T' },
  spin: { ar: 'دوران', en: 'Spin' },
  viewHint: { ar: 'اسحب للتدوير • قرّب بإصبعين أو بالعجلة', en: 'Drag to rotate • pinch or scroll to zoom' },
  checkMode: { ar: 'معاينة ملف GLB المُصدَّر', en: 'Previewing the exported GLB' },
  backToEditor: { ar: 'رجوع للمحرّر', en: 'Back to editor' },

  // customize
  secBody: { ar: 'الجسم', en: 'Body' }, secHead: { ar: 'الرأس والشعر', en: 'Head & hair' }, secFace: { ar: 'الوجه', en: 'Face' },
  secClothes: { ar: 'الملابس', en: 'Clothing' }, secAcc: { ar: 'الإكسسوارات', en: 'Accessories' },
  skinColor: { ar: 'لون البشرة', en: 'Skin colour' },
  proportions: { ar: 'النسب', en: 'Proportions' }, resetProps: { ar: 'إعادة النسب', en: 'Reset proportions' },
  headScale: { ar: 'حجم الرأس', en: 'Head size' }, torsoWidth: { ar: 'عرض الجسم', en: 'Body width' }, torsoLength: { ar: 'طول الجذع', en: 'Torso length' },
  armLength: { ar: 'طول الذراعين', en: 'Arm length' }, legLength: { ar: 'طول الساقين', en: 'Leg length' }, limbThickness: { ar: 'سماكة الأطراف', en: 'Limb thickness' },
  material: { ar: 'الخامة', en: 'Material' }, gaze: { ar: 'اتجاه النظر', en: 'Gaze' }, side: { ar: 'الجهة', en: 'Side' },
  g_center: { ar: 'للأمام', en: 'Ahead' }, g_left: { ar: 'يسار', en: 'Left' }, g_right: { ar: 'يمين', en: 'Right' }, g_up: { ar: 'أعلى', en: 'Up' }, g_down: { ar: 'أسفل', en: 'Down' },
  s_left: { ar: 'اليسرى', en: 'Left' }, s_right: { ar: 'اليمنى', en: 'Right' }, s_both: { ar: 'الجهتان', en: 'Both' },
  addDetail: { ar: '+ تفصيلة للوجه', en: '+ Face detail' }, addAcc: { ar: '+ إكسسوار', en: '+ Accessory' },
  remove: { ar: 'حذف', en: 'Remove' }, attachTo: { ar: 'مكان التعليق', en: 'Attach to' },
  maxReached: { ar: 'وصلت للحد الأقصى ({n})', en: 'Maximum reached ({n})' },
  pickToAdd: { ar: 'اختر قطعة لإضافتها', en: 'Pick an item to add' },
  noneYet: { ar: 'لا شيء بعد', en: 'None yet' },
  sideNote: { ar: 'يسار ويمين الشخصية نفسها', en: "The character's own left / right" },

  // AI import
  aiTitle: { ar: 'استيراد أوامر الذكاء الاصطناعي', en: 'Import AI commands' },
  aiHelp: { ar: 'الصق هنا رد JSON الذي أعطاك إياه نموذج الذكاء الاصطناعي، أو افتح ملف JSON. يتم فحص كل قيمة قبل التطبيق، ولا يُنفَّذ أي كود.', en: 'Paste the JSON the AI model gave you, or open a JSON file. Every value is checked before it is applied; nothing is ever executed.' },
  aiPlaceholder: { ar: '{ "schemaVersion": "1.0", "character": { … } }', en: '{ "schemaVersion": "1.0", "character": { … } }' },
  aiApply: { ar: 'تطبيق الأوامر', en: 'Apply commands' },
  aiOpen: { ar: 'فتح ملف JSON', en: 'Open JSON file' },
  aiExample: { ar: 'لصق مثال', en: 'Paste example' },
  aiClear: { ar: 'مسح', en: 'Clear' },
  aiMode: { ar: 'طريقة التطبيق', en: 'Apply as' },
  modeDoc: { ar: 'حسب ما يطلبه الملف', en: 'As the file says' },
  modeReplace: { ar: 'شخصية جديدة من القاعدة', en: 'New character from base' },
  modePatch: { ar: 'تعديل الشخصية الحالية فقط', en: 'Change the current character' },
  rOk: { ar: 'تم التطبيق: {n} قيمة.', en: 'Applied: {n} values.' },
  rOkUndo: { ar: 'يمكنك التراجع بزر «تراجع».', en: 'Use Undo to revert.' },
  rRejected: { ar: 'لم يُطبَّق شيء، والشخصية الحالية لم تتغيّر.', en: 'Nothing was applied; the current character is unchanged.' },
  rCounts: { ar: '{e} خطأ • {w} تنبيه • {i} ملاحظة', en: '{e} errors • {w} warnings • {i} notes' },
  rApplyValid: { ar: 'طبّق القيم الصحيحة فقط', en: 'Apply only the valid values' },
  lvError: { ar: 'خطأ', en: 'Error' }, lvWarning: { ar: 'تنبيه', en: 'Warning' }, lvInfo: { ar: 'ملاحظة', en: 'Note' },
  aiNotes: { ar: 'ملاحظات النموذج على هذه الشخصية', en: 'The model’s notes on this character' },
  refDesc: { ar: 'وصف الصورة المرجعية', en: 'Reference description' },
  uncertain: { ar: 'أشياء خمّنها', en: 'Guessed' }, unsupported: { ar: 'غير مدعوم في مكتبة القطع', en: 'Not supported by the asset library' },
  fileReadError: { ar: 'تعذّرت قراءة الملف.', en: 'Could not read the file.' },
  whole: { ar: 'المستند', en: 'Document' },

  // prompt
  promptTitle: { ar: 'Image-to-Character AI Prompt', en: 'Image-to-Character AI Prompt' },
  promptSub: { ar: 'برومبت يحوّل صورة أي شخصية إلى أوامر JSON يفهمها هذا التطبيق، ويعمل مع أي نموذج يقرأ الصور.', en: 'Turns a picture of any character into JSON commands this app understands. Works with any model that can read images.' },
  step1: { ar: 'انسخ البرومبت الكامل (فيه التعليمات والسكيما وكتالوج القطع).', en: 'Copy the full prompt (instructions, schema and the asset catalog).' },
  step2: { ar: 'افتح أي نموذج ذكاء اصطناعي يقرأ الصور (ChatGPT أو Gemini أو Claude…)، أرفق صورة الشخصية والصق البرومبت.', en: 'Open any image-capable AI model (ChatGPT, Gemini, Claude…), attach the character picture and paste the prompt.' },
  step3: { ar: 'انسخ رد النموذج كما هو (JSON فقط).', en: 'Copy the model’s reply as it is (JSON only).' },
  step4: { ar: 'الصقه في تبويب «أوامر AI» واضغط «تطبيق الأوامر»، ثم عدّل يدوياً إن أردت.', en: 'Paste it in the “AI import” tab, press “Apply commands”, then fine-tune by hand.' },
  copyFull: { ar: 'نسخ البرومبت الكامل', en: 'Copy full prompt' },
  copyShort: { ar: 'نسخ البرومبت بدون الكتالوج', en: 'Copy prompt without catalog' },
  copyCatalog: { ar: 'نسخ كتالوج القطع', en: 'Copy asset catalog' },
  dlCatalog: { ar: 'تنزيل الكتالوج JSON', en: 'Download catalog JSON' },
  dlSchema: { ar: 'تنزيل JSON Schema', en: 'Download JSON Schema' },
  promptStats: { ar: '{a} قطعة • {s} خانة • سكيما {v} • {c} حرف', en: '{a} assets • {s} slots • schema {v} • {c} characters' },
  copied: { ar: 'تم النسخ', en: 'Copied' },
  copyFailed: { ar: 'لم يسمح المتصفح بالنسخ. النص محدَّد، انسخه يدوياً.', en: 'The browser blocked copying. The text is selected; copy it manually.' },
  goAi: { ar: 'الذهاب إلى «أوامر AI»', en: 'Go to “AI import”' },

  // characters
  charsTitle: { ar: 'شخصياتي', en: 'My characters' },
  current: { ar: 'الشخصية الحالية', en: 'Current character' },
  save: { ar: 'حفظ', en: 'Save' }, saveCopy: { ar: 'حفظ كنسخة جديدة', en: 'Save as copy' },
  dlJson: { ar: 'تنزيل JSON', en: 'Download JSON' }, openJson: { ar: 'فتح ملف شخصية', en: 'Open character file' },
  resetBase: { ar: 'إعادة إلى القاعدة', en: 'Reset to base' },
  newFromBase: { ar: 'شخصية جديدة من قاعدة', en: 'New character from a base' },
  basesHelp: { ar: 'كل شخصية تبدأ من قاعدة. أوامر الذكاء الاصطناعي تعدّل القاعدة ولا تصنع موديلاً جديداً.', en: 'Every character starts from a base. AI commands modify the base; they never create a new model.' },
  savedList: { ar: 'المحفوظة', en: 'Saved' },
  emptyLib: { ar: 'لا توجد شخصيات محفوظة بعد. اضغط «حفظ» لحفظ الشخصية الحالية.', en: 'No saved characters yet. Press “Save” to keep the current one.' },
  open: { ar: 'فتح', en: 'Open' }, duplicate: { ar: 'تكرار', en: 'Duplicate' }, del: { ar: 'حذف', en: 'Delete' },
  confirmDel: { ar: 'حذف نهائي؟', en: 'Delete for good?' }, yesDel: { ar: 'نعم، احذف', en: 'Yes, delete' }, cancel: { ar: 'إلغاء', en: 'Cancel' },
  confirmLeave: { ar: 'في الشخصية الحالية تغييرات غير محفوظة. هل تتابع وتتركها؟', en: 'The current character has unsaved changes. Continue anyway?' },
  confirmLeaveYes: { ar: 'نعم، تابع', en: 'Yes, continue' },
  storeCloud: { ar: 'تُحفظ في حسابك على Claude وتظهر على كل أجهزتك.', en: 'Saved to your Claude account, on all your devices.' },
  storeLocal: { ar: 'تُحفظ في هذا المتصفح فقط. نزّل JSON كنسخة احتياطية.', en: 'Saved in this browser only. Download JSON as a backup.' },
  copySuffix: { ar: ' (نسخة)', en: ' (copy)' },
  savedToast: { ar: 'تم حفظ «{n}»', en: 'Saved “{n}”' },
  loadedToast: { ar: 'تم فتح «{n}»', en: 'Opened “{n}”' },
  deletedToast: { ar: 'تم الحذف', en: 'Deleted' },
  saveFailed: { ar: 'تعذّر الحفظ: {m}', en: 'Could not save: {m}' },
  updated: { ar: 'آخر تعديل', en: 'Updated' },

  // export
  exportTitle: { ar: 'تصدير الشخصية', en: 'Export the character' },
  exportHelp: { ar: 'ملف GLB موديل ثلاثي الأبعاد حقيقي: هيكل عظمي من 20 مفصلاً بأسماء VRM، وخط الحبر، والألوان. ملف JSON يحفظ كل اختيارات الشخصية. ملف ليمونات يضيفها إلى اللعبة مباشرة.', en: 'GLB is a real 3D model: a 20-bone skeleton with VRM names, ink outline and colours. The JSON keeps every choice. The Limonat file adds the character to the game.' },
  restPose: { ar: 'الوضعية الأساسية', en: 'Rest pose' }, rpArms: { ar: 'أذرع للأسفل (ليمونات)', en: 'Arms down (Limonat)' }, rpT: { ar: 'T-pose (VRM / تتبّع الحركة)', en: 'T-pose (VRM / motion capture)' },
  facing: { ar: 'اتجاه الوجه', en: 'Facing' }, fLimonat: { ar: '‎−Z (مثل ليمونات)', en: '−Z (Limonat)' }, fGltf: { ar: '‎+Z (معيار glTF / VRM)', en: '+Z (glTF / VRM standard)' },
  shading: { ar: 'التظليل', en: 'Shading' }, shFlat: { ar: 'مسطّح مثل اللعبة', en: 'Flat, like the game' }, shPbr: { ar: 'PBR (Blender / Unity)', en: 'PBR (Blender / Unity)' },
  anims: { ar: 'تضمين حركات تجريبية: idle و walk و wave', en: 'Include test clips: idle, walk, wave' },
  dlGlb: { ar: 'تنزيل GLB', en: 'Download GLB' }, dlMeta: { ar: 'تنزيل بيانات JSON', en: 'Download metadata JSON' },
  dlJs: { ar: 'تنزيل ملف ليمونات JS', en: 'Download Limonat JS' }, dlZip: { ar: 'تنزيل الحزمة كاملة (ZIP)', en: 'Download full package (ZIP)' },
  verify: { ar: 'افتح الملف المُصدَّر للتحقق', en: 'Re-open the exported file' },
  verifyOk: { ar: 'أُعيد فتح ملف GLB بنجاح: {b} عظمة، {m} شبكة بهيكل، الحركات: {c}.', en: 'GLB re-opened: {b} bones, {m} skinned meshes, clips: {c}.' },
  stBones: { ar: 'عظام', en: 'Bones' }, stTris: { ar: 'مثلثات', en: 'Triangles' }, stHeight: { ar: 'الطول', en: 'Height' }, stParts: { ar: 'مكعبات', en: 'Boxes' },
  limonatHow: { ar: 'إضافتها إلى ليمونات', en: 'Adding it to Limonat' },
  limonatSteps: { ar: 'انسخ ملف ‎.limonat.js إلى مجلد js/characters في اللعبة، ثم أضف سطر script بعد js/character.js في index.html. تظهر الشخصية في قائمة «الشخصية». (التفاصيل في docs/LIMONAT_INTEGRATION.md)', en: 'Copy the .limonat.js file to js/characters/ in the game and add a script tag after js/character.js in index.html. The character then shows up in the Character menu. (Details: docs/LIMONAT_INTEGRATION.md)' },
  exporting: { ar: 'جارٍ التجهيز…', en: 'Preparing…' },
  dlSaved: { ar: 'تم تنزيل {n}', en: 'Downloaded {n}' },
  dlZipped: { ar: 'تم تنزيل {n} (هذا العارض لا يقبل الامتداد الأصلي فوُضع الملف داخل ZIP)', en: 'Downloaded {n} (this viewer does not accept the original extension, so it is inside a ZIP)' },
  dlDeclined: { ar: 'أُلغي التنزيل', en: 'Download cancelled' },
  dlUnavailable: { ar: 'التنزيل غير متاح في هذا العارض', en: 'Downloads are not available in this viewer' },
  exportFailed: { ar: 'فشل التصدير: {m}', en: 'Export failed: {m}' },
};

let lang = 'ar';
const listeners = new Set();
export function getLang() { return lang; }
export function setLang(l) {
  lang = l === 'en' ? 'en' : 'ar';
  if (typeof document !== 'undefined') {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }
  for (const fn of listeners) fn(lang);
}
export function onLang(fn) { listeners.add(fn); return () => listeners.delete(fn); }

/** Translate a key; {name} placeholders are filled from vars. */
export function t(key, vars) {
  const e = S[key];
  let s = e ? (e[lang] ?? e.en) : key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split('{' + k + '}').join(String(v));
  return s;
}
/** Pick the current language from a { en, ar } label. */
export function L(label) { return !label ? '' : typeof label === 'string' ? label : (label[lang] || label.en || ''); }
