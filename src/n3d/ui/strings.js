/* Interface strings of the Normal 3D mode (Arabic default, English via the toggle).
 * Asset, parameter and fabric names come from their own { en, ar } labels. */
import { getLang } from '../../ui/i18n.js';

const S = {
  appSub: { ar: 'شخصيات ثلاثية الأبعاد واقعية ومنمّقة', en: 'Realistic and stylized 3D characters' },
  modeVoxel: { ar: 'مكعّبات', en: 'Voxel' }, modeN3D: { ar: '3D عادي', en: 'Normal 3D' }, modeLabel: { ar: 'نمط الإنشاء', en: 'Creation mode' },
  modeSwitched: { ar: 'تم التبديل إلى نمط {m}. كل نمط يحتفظ بشخصيته وعمله.', en: 'Switched to {m} mode. Each mode keeps its own character and work.' },
  tabCustomize: { ar: 'تخصيص', en: 'Customize' }, tabAi: { ar: 'أوامر AI', en: 'AI import' }, tabPrompt: { ar: 'البرومبت', en: 'AI prompt' }, tabChars: { ar: 'شخصياتي', en: 'Characters' }, tabExport: { ar: 'تصدير', en: 'Export' },
  name: { ar: 'اسم الشخصية', en: 'Character name' }, undo: { ar: 'تراجع', en: 'Undo' }, redo: { ar: 'إعادة', en: 'Redo' },
  unsaved: { ar: 'غير محفوظة', en: 'Unsaved' }, savedChip: { ar: 'محفوظة', en: 'Saved' }, newChip: { ar: 'جديدة', en: 'New' },
  // stage
  vFront: { ar: 'أمام', en: 'Front' }, vSide: { ar: 'جانب', en: 'Side' }, vBack: { ar: 'خلف', en: 'Back' }, v34: { ar: '¾', en: '¾' }, vFace: { ar: 'وجه', en: 'Face' }, vUpper: { ar: 'نصف علوي', en: 'Upper' }, vHands: { ar: 'يد', en: 'Hand' }, vFeet: { ar: 'قدم', en: 'Feet' },
  pRest: { ar: 'A', en: 'A' }, pRelaxed: { ar: 'استرخاء', en: 'Relaxed' }, pIdle: { ar: 'تنفّس', en: 'Idle' }, pWalk: { ar: 'مشي', en: 'Walk' }, pWave: { ar: 'تلويح', en: 'Wave' }, pT: { ar: 'T', en: 'T' },
  mPbr: { ar: 'خامات', en: 'Materials' }, mClay: { ar: 'طين', en: 'Clay' }, mWire: { ar: 'شبكة', en: 'Wireframe' }, mNormals: { ar: 'اتجاهات', en: 'Normals' }, mUv: { ar: 'UV', en: 'UV' }, mMaterials: { ar: 'أجزاء الخامة', en: 'Material slots' },
  lighting: { ar: 'الإضاءة', en: 'Lighting' }, lStudio: { ar: 'استوديو', en: 'Studio' }, lDay: { ar: 'نهار', en: 'Daylight' }, lIndoor: { ar: 'داخلي دافئ', en: 'Warm indoor' }, lDramatic: { ar: 'درامي', en: 'Dramatic' }, lFlat: { ar: 'مسطّح', en: 'Flat' },
  inspect: { ar: 'العرض', en: 'Display' }, spin: { ar: 'دوران', en: 'Spin' }, pose: { ar: 'الوضعية', en: 'Pose' },
  building: { ar: 'جارٍ البناء…', en: 'Building…' }, stage_anatomy: { ar: 'الجسم', en: 'Body' }, stage_garments: { ar: 'الملابس', en: 'Clothes' }, stage_hair: { ar: 'الشعر', en: 'Hair' }, stage_accessories: { ar: 'الإكسسوارات', en: 'Accessories' }, stage_face: { ar: 'الوجه', en: 'Face' }, stage_finish: { ar: 'تم', en: 'Done' },
  buildError: { ar: 'تعذّر بناء جزء: {m}', en: 'Could not build a part: {m}' },
  viewHint: { ar: 'اسحب للتدوير • إصبعان أو زر الفأرة الأيمن للتحريك • العجلة للتقريب', en: 'Drag to orbit • two fingers / right button to pan • scroll to zoom' },
  compareOff: { ar: 'إيقاف المقارنة', en: 'Stop comparing' }, comparing: { ar: 'مقارنة مع: {n}', en: 'Comparing with: {n}' },
  // sections
  secBody: { ar: 'الجسم', en: 'Body' }, secFace: { ar: 'الوجه', en: 'Face' }, secHair: { ar: 'الشعر', en: 'Hair' }, secUpper: { ar: 'الجزء العلوي', en: 'Upper body' }, secLower: { ar: 'الجزء السفلي', en: 'Lower body' },
  secFull: { ar: 'ملابس كاملة', en: 'Full body' }, secFeet: { ar: 'الأحذية', en: 'Footwear' }, secAcc: { ar: 'الإكسسوارات', en: 'Accessories' }, secMat: { ar: 'الخامات', en: 'Materials' }, secAdv: { ar: 'متقدم', en: 'Advanced' },
  presets: { ar: 'أجسام جاهزة', en: 'Body presets' }, charPresets: { ar: 'شخصيات جاهزة', en: 'Character presets' }, applyPreset: { ar: 'تطبيق', en: 'Apply' },
  skin: { ar: 'البشرة', en: 'Skin' }, skinTone: { ar: 'لون البشرة', en: 'Skin tone' }, eyes: { ar: 'العينان', en: 'Eyes' }, iris: { ar: 'لون القزحية', en: 'Iris colour' }, sclera: { ar: 'بياض العين', en: 'Sclera' }, lashColor: { ar: 'لون الرموش', en: 'Lash colour' },
  brows: { ar: 'الحاجبان', en: 'Eyebrows' }, browColor: { ar: 'لون الحاجبين', en: 'Brow colour' }, sameAsHair: { ar: 'مثل الشعر', en: 'Same as hair' }, facialHair: { ar: 'شعر الوجه', en: 'Facial hair' }, makeup: { ar: 'المكياج', en: 'Makeup' },
  lipColor: { ar: 'لون الشفاه', en: 'Lip colour' }, blushColor: { ar: 'لون أحمر الخدود', en: 'Blush colour' }, eyeShadowColor: { ar: 'لون ظل العيون', en: 'Eye shadow colour' },
  scars: { ar: 'الندوب', en: 'Scars' }, addScar: { ar: '+ ندبة', en: '+ Scar' }, at: { ar: 'المكان', en: 'Where' }, size: { ar: 'الحجم', en: 'Size' }, angle: { ar: 'الزاوية', en: 'Angle' },
  hairStyle: { ar: 'التسريحة', en: 'Hairstyle' }, hairColors: { ar: 'ألوان الشعر', en: 'Hair colours' },
  wearing: { ar: 'ما ترتديه الشخصية', en: 'Worn now' }, add: { ar: 'إضافة', en: 'Add' }, addItem: { ar: '+ إضافة قطعة', en: '+ Add an item' }, remove: { ar: 'إزالة', en: 'Remove' }, replace: { ar: 'استبدال', en: 'Replace' },
  moveUp: { ar: 'طبقة للداخل', en: 'Layer inward' }, moveDown: { ar: 'طبقة للخارج', en: 'Layer outward' },
  noneWorn: { ar: 'لا شيء من هذا القسم', en: 'Nothing from this section' }, search: { ar: 'بحث…', en: 'Search…' }, allTags: { ar: 'الكل', en: 'All' },
  params: { ar: 'الإعدادات', en: 'Settings' }, colors: { ar: 'الألوان', en: 'Colours' }, fabric: { ar: 'القماش', en: 'Fabric' }, pattern: { ar: 'النقشة', en: 'Pattern' }, patternScale: { ar: 'حجم النقشة', en: 'Pattern size' },
  wear: { ar: 'البهتان / الاستعمال', en: 'Wear / fading' }, hardware: { ar: 'الإكسسوارات المعدنية', en: 'Hardware finish' },
  maxReached: { ar: 'وصلت للحد الأقصى ({n})', en: 'Maximum reached ({n})' },
  detail: { ar: 'مستوى التفاصيل', en: 'Detail level' }, detailNote: { ar: 'المستويات الأعلى أدق لكن أبطأ في البناء.', en: 'Higher levels are finer but slower to build.' },
  stats: { ar: 'الإحصاءات', en: 'Statistics' }, triangles: { ar: 'مثلثات', en: 'triangles' }, meshes: { ar: 'أجزاء', en: 'meshes' }, buildTime: { ar: 'زمن البناء', en: 'Build time' },
  resetAll: { ar: 'شخصية جديدة', en: 'New character' }, resetSection: { ar: 'إعادة القيم', en: 'Reset values' }, randomize: { ar: 'شخصية عشوائية', en: 'Random character' },
  jsonView: { ar: 'مستند الشخصية (JSON)', en: 'Character document (JSON)' }, applyJson: { ar: 'تطبيق التعديلات', en: 'Apply changes' },
  confirmNew: { ar: 'بدء شخصية جديدة؟ التغييرات غير المحفوظة ستضيع (يمكنك التراجع).', en: 'Start a new character? Unsaved changes are lost (you can undo).' },
  yes: { ar: 'نعم', en: 'Yes' }, cancel: { ar: 'إلغاء', en: 'Cancel' },
  // AI
  aiTitle: { ar: 'استيراد شخصية من الذكاء الاصطناعي', en: 'Import a character from an AI model' },
  aiHelp: { ar: 'انسخ البرومبت من تبويب «البرومبت» وأعطه لأي نموذج ذكاء اصطناعي مع صورة مرجعية، ثم الصق الـ JSON الناتج هنا.', en: 'Copy the prompt from the AI prompt tab, give it to any AI model together with a reference image, then paste the JSON it writes here.' },
  pasteHere: { ar: 'الصق JSON هنا…', en: 'Paste JSON here…' }, check: { ar: 'تحقّق', en: 'Check' }, applyReplace: { ar: 'استبدال الشخصية', en: 'Replace the character' }, applyMerge: { ar: 'تطبيق كتعديلات', en: 'Apply as changes' },
  openFile: { ar: 'فتح ملف…', en: 'Open file…' }, valid: { ar: 'صالح ✓', en: 'Valid ✓' }, invalid: { ar: 'فيه أخطاء — الأجزاء الخاطئة لن تُطبَّق', en: 'Has errors — the wrong parts will not be applied' },
  errorsN: { ar: '{n} أخطاء', en: '{n} errors' }, warningsN: { ar: '{n} تنبيهات', en: '{n} warnings' }, applied: { ar: 'تم التطبيق', en: 'Applied' },
  voxelDoc: { ar: 'هذا ملف شخصية مكعّبات. افتحه في نمط «مكعّبات».', en: 'This is a voxel character file. Open it in Voxel mode.' },
  promptTitle: { ar: 'برومبت «صورة إلى شخصية 3D»', en: 'Normal 3D Image-to-Character prompt' },
  promptHelp: { ar: 'هذا البرومبت مولّد من مكتبة الأجزاء الحالية، فلا يذكر إلا ما يدعمه البرنامج. انسخه وأرسله مع صورة لأي نموذج.', en: 'This prompt is generated from the live asset library, so it only mentions what the creator supports. Copy it and send it with an image to any model.' },
  copy: { ar: 'نسخ', en: 'Copy' }, copied: { ar: 'تم النسخ', en: 'Copied' }, download: { ar: 'تنزيل', en: 'Download' }, withCatalog: { ar: 'مع الكتالوج الكامل', en: 'With the full catalog' },
  schemaFile: { ar: 'مخطط JSON Schema', en: 'JSON Schema' }, catalogFile: { ar: 'كتالوج الأجزاء (JSON)', en: 'Asset catalog (JSON)' }, example: { ar: 'مثال', en: 'Example' },
  // characters
  charsTitle: { ar: 'شخصيات 3D المحفوظة', en: 'Saved Normal 3D characters' }, save: { ar: 'حفظ', en: 'Save' }, saveAs: { ar: 'حفظ كنسخة', en: 'Save a copy' },
  open: { ar: 'فتح', en: 'Open' }, duplicate: { ar: 'نسخ', en: 'Duplicate' }, rename: { ar: 'إعادة تسمية', en: 'Rename' }, del: { ar: 'حذف', en: 'Delete' }, compare: { ar: 'قارن', en: 'Compare' },
  exportJson: { ar: 'تنزيل JSON', en: 'Download JSON' }, importJson: { ar: 'استيراد ملف JSON', en: 'Import a JSON file' }, noChars: { ar: 'لا توجد شخصيات محفوظة بعد.', en: 'No saved characters yet.' },
  saved: { ar: 'تم الحفظ', en: 'Saved' }, deleted: { ar: 'تم الحذف', en: 'Deleted' }, confirmDelete: { ar: 'حذف «{n}» نهائياً؟', en: 'Delete “{n}” for good?' }, newName: { ar: 'الاسم الجديد', en: 'New name' },
  storeLocal: { ar: 'تُحفظ في هذا المتصفح', en: 'Stored in this browser' }, storeCloud: { ar: 'تُحفظ في حسابك (تظهر على كل أجهزتك)', en: 'Stored in your account (on all your devices)' },
  // export
  exportTitle: { ar: 'تصدير شخصية 3D', en: 'Export the Normal 3D character' },
  exportHelp: { ar: 'ملف GLB فيه الشبكات والخامات والصور وهيكل عظمي من 55 عظمة بأسماء VRM مع أوزان الجلد ونقاط التعليق، وملف بيانات JSON يصف كل جزء. يعمل في أي محرك ألعاب.', en: 'A GLB with meshes, materials, textures, a 55-bone VRM-named skeleton with skin weights and attachment points, plus a JSON metadata file describing every part. Works in any game engine.' },
  exportGlb: { ar: 'تصدير GLB', en: 'Export GLB' }, exportMeta: { ar: 'بيانات (JSON)', en: 'Metadata (JSON)' }, exportDoc: { ar: 'مستند الشخصية', en: 'Character document' }, exportLimonat: { ar: 'ملف ليمونات', en: 'Limonat file' },
  exportAll: { ar: 'تنزيل الكل (ZIP)', en: 'Download all (ZIP)' }, exporting: { ar: 'جارٍ التجهيز…', en: 'Preparing…' }, exportDone: { ar: 'تم التصدير', en: 'Exported' }, exportFailed: { ar: 'فشل التصدير: {m}', en: 'Export failed: {m}' },
  verify: { ar: 'افتح الملف المُصدَّر للتحقق', en: 'Re-open the exported file' }, report: { ar: 'تقرير الملف', en: 'File report' }, exportDetail: { ar: 'تفاصيل التصدير', en: 'Export detail' },
  // app / panels (additions)
  appTitle: { ar: 'صانع شخصيات ليمونات', en: 'Limonat Character Creator' },
  current: { ar: 'الشخصية الحالية', en: 'Current character' }, updated: { ar: 'آخر تعديل', en: 'Updated' }, copySuffix: { ar: ' (نسخة)', en: ' (copy)' },
  loaded: { ar: 'تم فتح «{n}»', en: 'Opened “{n}”' }, savedN: { ar: 'تم حفظ «{n}»', en: 'Saved “{n}”' }, saveFailed: { ar: 'تعذّر الحفظ: {m}', en: 'Could not save: {m}' },
  confirmLeave: { ar: 'في الشخصية الحالية تغييرات غير محفوظة. المتابعة؟ (يمكنك التراجع)', en: 'The current character has unsaved changes. Continue? (you can undo)' }, cont: { ar: 'متابعة', en: 'Continue' },
  savedList: { ar: 'المحفوظة', en: 'Saved' }, compareOn: { ar: 'إيقاف', en: 'Stop' }, fileError: { ar: 'تعذّرت قراءة الملف', en: 'Could not read the file' },
  newCharacter: { ar: 'شخصية جديدة', en: 'New character' }, renameOk: { ar: 'تمت إعادة التسمية', en: 'Renamed' },
  // AI import
  aiExample: { ar: 'مثال', en: 'Example' }, aiClear: { ar: 'مسح', en: 'Clear' }, applyValid: { ar: 'تطبيق الأجزاء الصحيحة فقط', en: 'Apply the valid parts only' },
  rApplied: { ar: 'تم التطبيق. يمكنك التراجع.', en: 'Applied. You can undo it.' }, rRejected: { ar: 'لم يُطبَّق شيء — صحّح الأخطاء أو طبّق الأجزاء الصحيحة فقط.', en: 'Nothing was applied — fix the errors or apply only the valid parts.' },
  rChecked: { ar: 'نتيجة الفحص (لم يُطبَّق شيء بعد)', en: 'Check result (nothing applied yet)' }, lvError: { ar: 'خطأ', en: 'Error' }, lvWarning: { ar: 'تنبيه', en: 'Warning' },
  notesTitle: { ar: 'ملاحظات النموذج', en: 'Notes from the model' }, switchToVoxel: { ar: 'افتح نمط المكعّبات', en: 'Open Voxel mode' },
  modeHelp: { ar: '«استبدال» يبني شخصية جديدة من المستند. «تعديلات» يغيّر فقط الحقول المذكورة في الشخصية الحالية.', en: '“Replace” builds a new character from the document. “Changes” only alters the fields it mentions on the current character.' },
  // prompt
  step1: { ar: 'انسخ البرومبت (الكامل يحوي كتالوج الأجزاء).', en: 'Copy the prompt (the full one includes the asset catalog).' },
  step2: { ar: 'افتح أي نموذج ذكاء اصطناعي، الصق البرومبت وأرفق صورة الشخصية أو اكتب وصفها.', en: 'Open any AI model, paste the prompt and attach the character image (or describe it).' },
  step3: { ar: 'انسخ الـ JSON الذي يكتبه النموذج.', en: 'Copy the JSON the model writes.' },
  step4: { ar: 'الصقه في تبويب «أوامر AI» واضغط «استبدال الشخصية».', en: 'Paste it in the AI import tab and press “Replace the character”.' },
  copyFull: { ar: 'نسخ البرومبت الكامل', en: 'Copy the full prompt' }, copyShort: { ar: 'نسخ بدون كتالوج', en: 'Copy without catalog' }, copyCatalog: { ar: 'نسخ الكتالوج', en: 'Copy the catalog' },
  copyFailed: { ar: 'تعذّر النسخ — النص محدد، انسخه يدوياً.', en: 'Copy failed — the text is selected, copy it manually.' }, goAi: { ar: 'إلى أوامر AI ←', en: 'Go to AI import →' },
  promptStats: { ar: '{a} جزءاً في {s} فئة • المخطط {v} • {c} حرفاً', en: '{a} assets in {s} slots • schema {v} • {c} characters' },
  // export
  facing: { ar: 'الاتجاه', en: 'Facing' }, fLimonat: { ar: 'ليمونات (‎-Z)', en: 'Limonat (−Z)' }, fGltf: { ar: 'glTF القياسي (‎+Z)', en: 'glTF standard (+Z)' },
  anims: { ar: 'تضمين الحركات (وقوف، مشي، تلويح)', en: 'Include clips (idle, walk, wave)' }, stBones: { ar: 'عظام', en: 'Bones' }, stTris: { ar: 'مثلثات', en: 'Triangles' }, stMeshes: { ar: 'أجزاء', en: 'Meshes' }, stHeight: { ar: 'الطول', en: 'Height' },
  verifyOk: { ar: 'الملف سليم: {b} عظمة، {m} شبكة مربوطة، {t} مثلث، {x} صورة، نقاط تعليق: {a}، الحركات: {c}', en: 'File OK: {b} bones, {m} skinned meshes, {t} triangles, {x} textures, attachment points: {a}, clips: {c}' },
  checkMode: { ar: 'تعرض الآن الملف المُصدَّر', en: 'Showing the exported file' }, backToEditor: { ar: 'رجوع للمحرر', en: 'Back to the editor' },
  limonatHow: { ar: 'الاستخدام في لعبة ليمونات', en: 'Using it in Limonat' },
  limonatSteps: { ar: 'في اللعبة: انسخ ملف GLB إلى مجلد characters، وأضف مرة واحدة ملفّي حزمة الربط (lib/three-gltf-loader.js و js/limonat-n3d.js من مجلد integration/limonat في المستودع)، ثم ملف ‎.limonat-n3d.js للشخصية. تظهر الشخصية في قائمة الشخصيات وتتحرك بأجزاء ليمونات الستة (الساقان، الجسم، الرأس، الذراعان) دون تعديل ملفات اللعبة. التفاصيل في docs/N3D_LIMONAT_INTEGRATION.md.', en: 'In the game: copy the GLB to characters/, add the two integration-kit files once (lib/three-gltf-loader.js and js/limonat-n3d.js from integration/limonat in the repository), then the character’s .limonat-n3d.js file. The character appears in the Character menu and moves with Limonat’s six parts (legs, body, head, arms) without changing any game file. Details: docs/N3D_LIMONAT_INTEGRATION.md.' },
  exportBuilding: { ar: 'جارٍ بناء الشخصية بمستوى «{d}»…', en: 'Building the character at “{d}” detail…' }, waitBuild: { ar: 'انتظر انتهاء البناء', en: 'Wait for the build to finish' },
  sizeNote: { ar: 'حجم تقريبي: {s}', en: 'Approximate size: {s}' },
};

export function T(key, vars) {
  const e = S[key];
  let s = e ? (e[getLang()] || e.en) : key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace('{' + k + '}', v);
  return s;
}
export function Lb(label) { return !label ? '' : typeof label === 'string' ? label : (label[getLang()] || label.en || ''); }
