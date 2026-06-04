// js/admin.js
import { db, firebaseConfig } from "./firebase-config.js";
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword,signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, setDoc, updateDoc, arrayUnion, collection, getDocs, deleteDoc, getDoc, query, where, limit, startAfter, endBefore, limitToLast, orderBy } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// متغيرات عالمية لمتابعة حالات التعديل
let editingTeacherId = null;
let editingStudentId = null;

// ==========================================
// الإعدادات الخاصة بالـ Pagination وحجم الصفحة
// ==========================================
const PAGE_SIZE = 5; // عدد العناصر المعروضة في الصفحة الواحدة

// مؤشرات الصفحات للطلاب
let studentFirstVisible = null;
let studentLastVisible = null;
let studentPageNum = 1;

// مؤشرات الصفحات للمعلمين
let teacherFirstVisible = null;
let teacherLastVisible = null;
let teacherPageNum = 1;

// ==========================================
// دالة التوستر (Notifications) الاحترافية بدلاً من الـ Alert
// ==========================================
function showToast(message, type = "success") {
    // إذا كان عندك دالة جاهزة في الـ UI لتشغيل التوستر، ضعها هنا.
    // كمثال متوافق مع نظامك الشيك:
    const toaster = document.getElementById('toast-container'); // أو الـ ID الخاص بك
    if (toaster) {
        // لوجيك إظهار التوستر الخاص بك
        console.log(`[${type.toUpperCase()}] ${message}`);
    } else {
        // حماية تضمن ظهور الرسالة للمستخدم في كل الأحوال حتى لو التوستر مش جاهز
        alert(`${type === "success" ? "✅" : "⚠️"} ${message}`);
    }
}

// دالة الـ Debouncing الذكية لمنع استهلاك كوتة السيرفر أثناء الكتابة الحية
function debounce(func, delay) {
    let timeoutId;
    return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            func.apply(null, args);
        }, delay);
    };
}

// ==========================================
// 0. دالات جلب وتحديث البيانات المشتركة (الفصول والمواد والـ Dropdowns)
// ==========================================
async function loadAdminDynamicData() {
    try {
        // جلب الفصول من كولكشن classes
        const classesSnap = await getDocs(collection(db, "classes"));
        const classesList = [];
        classesSnap.forEach(doc => classesList.push(doc.data().name));

        // جلب المواد من كولكشن subjects
        const subjectsSnap = await getDocs(collection(db, "subjects"));
        const subjectsList = [];
        subjectsSnap.forEach(doc => subjectsList.push(doc.data().name));

        // تحديث قائمة فصول الطلاب (Dropdown في فورم الإضافة)
        const stuClassSelect = document.getElementById('stuClass');
        if (stuClassSelect) {
            stuClassSelect.innerHTML = '<option value="">-- اختر الفصل المدرسي --</option>';
            classesList.forEach(cls => {
                stuClassSelect.innerHTML += `<option value="${cls}">فصل ${cls}</option>`;
            });
        }

        // تحديث قائمة فصول فلترة الطلاب في جدول العرض (Dropdown التصفية)
        const filterStuClassSelect = document.getElementById('filterStuClass');
        if (filterStuClassSelect) {
            const currentSelected = filterStuClassSelect.value;
            filterStuClassSelect.innerHTML = '<option value="">-- كل الفصول --</option>';
            classesList.forEach(cls => {
                filterStuClassSelect.innerHTML += `<option value="${cls}">فصل ${cls}</option>`;
            });
            if (currentSelected) filterStuClassSelect.value = currentSelected;
        }

        // تحديث قائمة المواد في قسم رصد الدرجات (Dropdown)
        const gradeSubjectSelect = document.getElementById('subject');
        if (gradeSubjectSelect) {
            gradeSubjectSelect.innerHTML = '<option value="">-- اختر المادة المراد رصدها --</option>';
            subjectsList.forEach(sub => {
                gradeSubjectSelect.innerHTML += `<option value="${sub}">${sub}</option>`;
            });
        }

        // حقن الفصول كـ كروت أنيقة لإضافة معلم
        const teacherClassesContainer = document.getElementById('teacherClassesContainer');
        if (teacherClassesContainer) {
            teacherClassesContainer.innerHTML = classesList.length === 0 ? '<span style="color:#94a3b8; font-size:13px; grid-column: 1/-1;">⚠️ لا توجد فصول، أضف فصولاً من الأعلى أولاً</span>' : '';
            classesList.forEach(cls => {
                teacherClassesContainer.innerHTML += `
                    <label style="display: flex !important; align-items: center !important; gap: 10px !important; padding: 10px 12px !important; background: #ffffff !important; border: 1px solid #e2e8f0 !important; border-radius: 6px !important; cursor: pointer !important; user-select: none !important; width: 100% !important; box-sizing: border-box !important; direction: rtl !important;">
                        <input type="checkbox" name="teacherClasses" value="${cls}" style="accent-color: #2563eb !important; transform: scale(1.2) !important;">
                        <span style="font-size: 13.5px !important; font-weight: 600 !important; color: #334155 !important;">فصل ${cls}</span>
                    </label>
                `;
            });
        }

        // حقن المواد كـ كروت أنيقة لإضافة معلم
        const teacherSubjectsContainer = document.getElementById('teacherSubjectsContainer');
        if (teacherSubjectsContainer) {
            teacherSubjectsContainer.innerHTML = subjectsList.length === 0 ? '<span style="color:#94a3b8; font-size:13px; grid-column: 1/-1;">⚠️ لا توجد مواد، أضف مواداً من الأعلى أولاً</span>' : '';
            subjectsList.forEach(sub => {
                teacherSubjectsContainer.innerHTML += `
                    <label style="display: flex !important; align-items: center !important; gap: 10px !important; padding: 10px 12px !important; background: #ffffff !important; border: 1px solid #e2e8f0 !important; border-radius: 6px !important; cursor: pointer !important; user-select: none !important; width: 100% !important; box-sizing: border-box !important; direction: rtl !important;">
                        <input type="checkbox" name="teacherSubjects" value="${sub}" style="accent-color: #2563eb !important; transform: scale(1.2) !important;">
                        <span style="font-size: 13.5px !important; font-weight: 600 !important; color: #334155 !important;">${sub}</span>
                    </label>
                `;
            });
        }

        // تحديث جدول المواد المتاحة أسفل الصفحة
        const subjectsTableBody = document.getElementById('subjectsTableBody');
        if (subjectsTableBody) {
            subjectsTableBody.innerHTML = subjectsList.length === 0 ? '<tr><td style="text-align:center; padding:15px; color:#94a3b8;">لا توجد مواد مسجلة</td></tr>' : '';
            subjectsList.forEach(sub => {
                subjectsTableBody.innerHTML += `
                    <tr style="border-bottom: 1px solid #e2e8f0;">
                        <td style="padding:12px; font-weight:600; color:#1e293b;">${sub}</td>
                    </tr>
                `;
            });
        }

    } catch (e) {
        console.error("حدث خطأ أثناء تحميل البيانات اللحظية للوحة:", e);
    }
}

// ==========================================
// 🌐 نظام جلب وعرض المعلمين المطور بالصفحات (Pagination) والبحث الكلي
// ==========================================
async function loadTeachersData(navigationAction = "init") {
    const teachersTableBody = document.getElementById('teachersTableBody');
    if (!teachersTableBody) return;

    try {
        teachersTableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 20px; color:#94a3b8;">جاري تحميل المعلمين...</td></tr>';

        const searchTeacherInput = document.getElementById('searchTeacherInput');
        const searchQuery = searchTeacherInput ? searchTeacherInput.value.trim() : "";
        let q;

        // بناء كويري الفايربيز الأساسية بناءً على ميزة التنقل والبحث
        if (searchQuery) {
            q = query(
                collection(db, "users"),
                where("role", "==", "teacher"),
                orderBy("name"),
                where("name", ">=", searchQuery),
                where("name", "<=", searchQuery + "\uf8ff"),
                limit(PAGE_SIZE)
            );
        } else {
            if (navigationAction === "next" && teacherLastVisible) {
                q = query(collection(db, "users"), where("role", "==", "teacher"), orderBy("name"), startAfter(teacherLastVisible), limit(PAGE_SIZE));
            } else if (navigationAction === "prev" && teacherFirstVisible) {
                q = query(collection(db, "users"), where("role", "==", "teacher"), orderBy("name"), endBefore(teacherFirstVisible), limitToLast(PAGE_SIZE));
            } else {
                q = query(collection(db, "users"), where("role", "==", "teacher"), orderBy("name"), limit(PAGE_SIZE));
                teacherPageNum = 1;
            }
        }

        const querySnapshot = await getDocs(q);
        const teachersPageIndicator = document.getElementById('teachersPageIndicator');

        // التحقق من وجود بيانات
        if (querySnapshot.empty) {
            if (navigationAction === "next") {
                showToast("⚠️ لا توجد صفحات تالية", "error");
                loadTeachersData("init");
                return;
            }
            teachersTableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px; color:#94a3b8;">لا يوجد معلمون يطابقون البحث حالياً</td></tr>';
            if (teachersPageIndicator) teachersPageIndicator.innerText = `صفحة ${teacherPageNum}`;
            return;
        }

        // تخزين مؤشرات الـ Pagination الخاصة بالسيرفر للحركات القادمة
        teacherFirstVisible = querySnapshot.docs[0];
        teacherLastVisible = querySnapshot.docs[querySnapshot.docs.length - 1];

        // تحديث رقم الصفحة الظاهري
        if (navigationAction === "next") teacherPageNum++;
        if (navigationAction === "prev") teacherPageNum = Math.max(1, teacherPageNum - 1);
        if (teachersPageIndicator) teachersPageIndicator.innerText = `صفحة ${teacherPageNum}`;

        teachersTableBody.innerHTML = "";
        querySnapshot.forEach(docSnap => {
            const userData = docSnap.data();
            const subDisplay = Array.isArray(userData.subject) ? userData.subject.join(' ، ') : (userData.subject || "غير محدد");
            const clsDisplay = Array.isArray(userData.class) ? userData.class.join(' ، ') : (userData.class || "غير محدد");

            teachersTableBody.innerHTML += `
                <tr style="border-bottom: 1px solid #e2e8f0;">
                    <td style="padding:12px; font-weight:600; color:#1e293b;">${userData.name || 'بدون اسم'}</td>
                    <td style="padding:12px; color:#475569; font-size:14px;">${userData.email}</td>
                    <td style="padding:12px;"><span style="background:#eff6ff; color:#2563eb; padding:4px 10px; border-radius:12px; font-size:12px; font-weight:600; display:inline-block;">${subDisplay}</span></td>
                    <td style="padding:12px;"><span style="background:#f0fdf4; color:#16a34a; padding:4px 10px; border-radius:12px; font-size:12px; font-weight:600; display:inline-block;">${clsDisplay}</span></td>
                    <td style="padding:12px; display: flex; gap: 8px; justify-content: center;">
                        <button class="edit-teacher-btn" 
                            data-id="${docSnap.id}" 
                            data-name="${userData.name || ''}" 
                            data-email="${userData.email || ''}" 
                            data-subjects='${JSON.stringify(userData.subject || [])}' 
                            data-classes='${JSON.stringify(userData.class || [])}'
                            style="background:#eab308; color:white; border:none; padding:5px 12px; border-radius:6px; cursor:pointer; font-size:12px; font-weight:600; transition: 0.2s;">
                            تعديل
                        </button>
                        <button class="delete-teacher-btn" 
                            data-id="${docSnap.id}" 
                            data-name="${userData.name || ''}"
                            style="background:#ef4444; color:white; border:none; padding:5px 12px; border-radius:6px; cursor:pointer; font-size:12px; font-weight:600; transition: 0.2s;">
                            حذف
                        </button>
                    </td>
                </tr>
            `;
        });

    } catch (e) {
        console.error("خطأ جلب المعلمين:", e);
    }
}

// ==========================================
// 🌐 نظام جلب وعرض الطلاب المطور بالصفحات (Pagination) والفلترة والبحث بالاسم
// ==========================================
async function loadStudentsData(navigationAction = "init") {
    const tbody = document.getElementById('studentsTableBody');
    if (!tbody) return;

    try {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px; color:#94a3b8;">جاري تحميل كشف الطلاب...</td></tr>';

        const filterStuClass = document.getElementById('filterStuClass');
        const searchStudentInput = document.getElementById('searchStudentInput');
        
        const className = filterStuClass ? filterStuClass.value : "";
        const searchQuery = searchStudentInput ? searchStudentInput.value.trim() : "";

        let qConstraints = [orderBy("name")];

        // تصفية الفصول بالفورم
        if (className) {
            qConstraints.push(where("class", "==", className));
        }

        // تصفية البحث بالاسم النظيف
        if (searchQuery) {
            qConstraints.push(where("name", ">=", searchQuery));
            qConstraints.push(where("name", "<=", searchQuery + "\uf8ff"));
        }

        // بناء محددات الصفحات للسيرفر لمنع استهلاك الكوتة
        if (!searchQuery) {
            if (navigationAction === "next" && studentLastVisible) {
                qConstraints.push(startAfter(studentLastVisible));
            } else if (navigationAction === "prev" && studentFirstVisible) {
                qConstraints.push(endBefore(studentFirstVisible));
                qConstraints.push(limitToLast(PAGE_SIZE));
            } else {
                studentPageNum = 1;
            }
        }

        if (navigationAction !== "prev") {
            qConstraints.push(limit(PAGE_SIZE));
        }

        const q = query(collection(db, "students"), ...qConstraints);
        const querySnapshot = await getDocs(q);
        const studentsPageIndicator = document.getElementById('studentsPageIndicator');

        if (querySnapshot.empty) {
            if (navigationAction === "next") {
                showToast("⚠️ لا توجد صفحات تالية", "error");
                return;
            }
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px; color:#94a3b8; font-weight: 600;">لا يوجد طلاب يطابقون المعايير المحددة حالياً</td></tr>';
            if (studentsPageIndicator) studentsPageIndicator.innerText = `صفحة ${studentPageNum}`;
            return;
        }

        studentFirstVisible = querySnapshot.docs[0];
        studentLastVisible = querySnapshot.docs[querySnapshot.docs.length - 1];

        if (navigationAction === "next") studentPageNum++;
        if (navigationAction === "prev") studentPageNum = Math.max(1, studentPageNum - 1);
        if (studentsPageIndicator) studentsPageIndicator.innerText = `صفحة ${studentPageNum}`;

        tbody.innerHTML = "";
        querySnapshot.forEach(docSnap => {
            const stuData = docSnap.data();
            tbody.innerHTML += `
                <tr style="border-bottom: 1px solid #e2e8f0;">
                    <td style="padding:12px; font-weight:600; color:#1e293b;">${stuData.id}</td>
                    <td style="padding:12px; color:#475569;">${stuData.name}</td>
                    <td style="padding:12px;"><span style="background:#f0fdf4; color:#16a34a; padding:4px 10px; border-radius:12px; font-size:12px; font-weight:600;">فصل ${stuData.class}</span></td>
                    <td style="padding:12px; display: flex; gap: 8px; justify-content: center;">
                        <button class="edit-student-btn" 
                            data-id="${stuData.id}" 
                            data-name="${stuData.name}" 
                            data-class="${stuData.class}"
                            style="background:#eab308; color:white; border:none; padding:5px 12px; border-radius:6px; cursor:pointer; font-size:12px; font-weight:600; transition: 0.2s;">
                            تعديل
                        </button>
                        <button class="delete-student-btn" 
                            data-id="${stuData.id}" 
                            data-name="${stuData.name}"
                            style="background:#ef4444; color:white; border:none; padding:5px 12px; border-radius:6px; cursor:pointer; font-size:12px; font-weight:600; transition: 0.2s;">
                            حذف
                        </button>
                    </td>
                </tr>
            `;
        });

    } catch (e) {
        console.error("خطأ أثناء جلب الطلاب المفلترين الباجينيشن:", e);
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:20px; color:#ef4444;">❌ فشل جلب البيانات: ${e.message}</td></tr>`;
    }
}

// ==========================================
// تشغيل وفحص المستمعين فور تحميل الصفحة بالكامل
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    // 1. تحميل قائمة المواد والفصول الديناميكية أولاً
    loadAdminDynamicData();
    
    // 🔥 2. جلب البيانات الأساسية للجداول فوراً عند فتح الصفحة
    loadTeachersData("init");
    loadStudentsData("init");

    // إعداد الـ Debounce للبحث الحي
    const liveTeacherSearch = debounce(() => {
        loadTeachersData("init");
    }, 400);
    const liveStudentSearch = debounce(() => {
        loadStudentsData("init");
    }, 400);

    setupTeachersTableActions();
    setupStudentsTableActions();

    // مراقبة أحداث البحث والفلترة والصفحات للطلاب
    document.getElementById('filterStuClass')?.addEventListener('change', () => loadStudentsData("init"));
    document.getElementById('searchStudentInput')?.addEventListener('input', liveStudentSearch);
    document.getElementById('nextStudentsBtn')?.addEventListener('click', () => loadStudentsData("next"));
    document.getElementById('prevStudentsBtn')?.addEventListener('click', () => loadStudentsData("prev"));

    // مراقبة أحداث البحث والصفحات للمعلمين
    document.getElementById('searchTeacherInput')?.addEventListener('input', liveTeacherSearch);
    document.getElementById('nextTeachersBtn')?.addEventListener('click', () => loadTeachersData("next"));
    document.getElementById('prevTeachersBtn')?.addEventListener('click', () => loadTeachersData("prev"));
});


// ==========================================
    // 🚪 تسجيل الخروج العودة لصفحة الـ Login
    // ==========================================
    document.getElementById('logoutBtn')?.addEventListener('click', async () => {
        if (confirm("هل أنت متأكد من رغبتك في تسجيل الخروج؟")) {
            try {
                const mainAuth = getAuth(); // جلب نسخة الـ Auth الأساسية للآدمين
                await signOut(mainAuth);
                
                showToast("تم تسجيل الخروج بنجاح، جاري توجيهك...", "success");
                
                // توجيه المستخدم لصفحة تسجيل الدخول بعد ثانية ونصف
                setTimeout(() => {
                    window.location.href = "login.html"; 
                }, 1500);
                
            } catch (error) {
                showToast("❌ خطأ أثناء تسجيل الخروج: " + error.message, "error");
            }
        }
    });
// ==========================================
// لوجيك مراقبة الإجراءات والتعديلات داخل جدول الطلاب (CRUD)
// ==========================================
function setupStudentsTableActions() {
    const studentsTableBody = document.getElementById('studentsTableBody');
    if (!studentsTableBody) return;

    studentsTableBody.addEventListener('click', async (e) => {
        if (e.target.classList.contains('edit-student-btn')) {
            const btn = e.target;
            editingStudentId = btn.getAttribute('data-id');

            const idInput = document.getElementById('stuId');
            idInput.value = editingStudentId;
            idInput.disabled = true;

            document.getElementById('stuName').value = btn.getAttribute('data-name');
            document.getElementById('stuClass').value = btn.getAttribute('data-class');

            const submitBtn = document.getElementById('addStudentBtn');
            if (submitBtn) {
                submitBtn.innerHTML = "💾 تحديث بيانات الطالب الحالي";
                submitBtn.style.background = "#10b981";
            }
            document.getElementById('stuId').scrollIntoView({ behavior: 'smooth' });
        }

        if (e.target.classList.contains('delete-student-btn')) {
            const stuId = e.target.getAttribute('data-id');
            const stuName = e.target.getAttribute('data-name');

            if (confirm(`⚠️ هل أنت متأكد تماماً من حذف الطالب (${stuName}) نهائياً؟ سيتم مسح ملفه السلوكي ودرجاته بالكامل!`)) {
                try {
                    await deleteDoc(doc(db, "students", stuId));
                    showToast(`✅ تم مسح سجلات الطالب (${stuName}) بنجاح!`);
                    loadStudentsData("init");
                } catch (error) {
                    showToast("❌ فشل الحذف: " + error.message, "error");
                }
            }
        }
    });
}

// ==========================================
// لوجيك مراقبة الإجراءات والتعديلات داخل جدول المعلمين (CRUD)
// ==========================================
function setupTeachersTableActions() {
    const teachersTableBody = document.getElementById('teachersTableBody');
    if (!teachersTableBody) return;

    teachersTableBody.addEventListener('click', async (e) => {
        if (e.target.classList.contains('edit-teacher-btn')) {
            const btn = e.target;
            editingTeacherId = btn.getAttribute('data-id');

            document.getElementById('teacherName').value = btn.getAttribute('data-name');
            const emailInput = document.getElementById('teacherEmail');
            emailInput.value = btn.getAttribute('data-email');
            emailInput.disabled = true;

            const passInput = document.getElementById('teacherPassword');
            if (passInput) {
                passInput.placeholder = "لا يمكن تغيير كلمة المرور من هنا";
                passInput.disabled = true;
                passInput.value = "";
            }

            const currentSubs = JSON.parse(btn.getAttribute('data-subjects'));
            const currentCls = JSON.parse(btn.getAttribute('data-classes'));

            document.querySelectorAll('input[name="teacherSubjects"]').forEach(cb => {
                cb.checked = currentSubs.includes(cb.value);
            });

            document.querySelectorAll('input[name="teacherClasses"]').forEach(cb => {
                cb.checked = currentCls.includes(cb.value);
            });

            const submitBtn = document.querySelector('#addTeacherForm button[type="submit"]');
            if (submitBtn) {
                submitBtn.innerHTML = "💾 تحديث بيانات المعلم الحالي";
                submitBtn.style.background = "#10b981";
            }
            document.getElementById('addTeacherForm').scrollIntoView({ behavior: 'smooth' });
        }

        if (e.target.classList.contains('delete-teacher-btn')) {
            const teacherId = e.target.getAttribute('data-id');
            const teacherName = e.target.getAttribute('data-name');

            if (confirm(`⚠️ هل أنت متأكد تماماً من حذف المعلم (${teacherName}) نهائياً من السيستم؟`)) {
                try {
                    await deleteDoc(doc(db, "users", teacherId));
                    showToast(`✅ تم حذف المعلم (${teacherName}) بنجاح!`);
                    loadTeachersData("init");
                } catch (error) {
                    showToast("❌ فشل الحذف: " + error.message, "error");
                }
            }
        }
    });
}

// ==========================================
// حفظ الفصول والمواد الجديدة
// ==========================================
document.getElementById('addClassBtn')?.addEventListener('click', async () => {
    const classInput = document.getElementById('newClassName');
    const className = classInput.value.trim();
    if (!className) return showToast("برجاء إدخال اسم الفصل أولاً", "error");
    try {
        await setDoc(doc(db, "classes", className), { name: className });
        showToast(`🎉 تم تثبيت الفصل (${className}) بنجاح!`);
        classInput.value = "";
        await loadAdminDynamicData();
    } catch (e) { showToast("خطأ أثناء حفظ الفصل: " + e.message, "error"); }
});

document.getElementById('addSubjectBtn')?.addEventListener('click', async () => {
    const subjectInput = document.getElementById('newSubjectName');
    const subjectName = subjectInput.value.trim();
    if (!subjectName) return showToast("برجاء إدخال اسم المادة أولاً", "error");
    try {
        await setDoc(doc(db, "subjects", subjectName), { name: subjectName });
        showToast(`🎉 تم تثبيت المادة (${subjectName}) بنجاح!`);
        subjectInput.value = "";
        await loadAdminDynamicData();
    } catch (e) { showToast("خطأ أثناء حفظ المادة: " + e.message, "error"); }
});

// ==========================================
// 1. إضافة طالب جديد أو تحديث بياناته
// ==========================================
document.getElementById('addStudentBtn')?.addEventListener('click', async () => {
    const idInput = document.getElementById('stuId');
    const nameInput = document.getElementById('stuName');
    const classInput = document.getElementById('stuClass');

    if (!idInput.value || !nameInput.value || !classInput.value) return showToast("برجاء إدخال البيانات كاملة وتحديد الفصل", "error");

    const targetId = idInput.value.trim();
    const targetName = nameInput.value.trim();
    const targetClass = classInput.value;

    if (editingStudentId) {
        try {
            await updateDoc(doc(db, "students", editingStudentId), {
                name: targetName,
                class: targetClass
            });
            showToast(`🎉 تم تحديث بيانات الطالب بنجاح!`);

            editingStudentId = null;
            idInput.disabled = false;
            idInput.value = "";
            nameInput.value = "";
            classInput.value = "";

            const submitBtn = document.getElementById('addStudentBtn');
            if (submitBtn) {
                submitBtn.innerHTML = "حفظ البيانات وإنشاء الـ Collections";
                submitBtn.style.background = "";
            }
            loadStudentsData("init");
        } catch (error) { showToast("❌ خطأ في السيرفر أثناء التعديل: " + error.message, "error"); }
        return;
    }

    try {
        const docSnap = await getDoc(doc(db, "students", targetId));
        if (docSnap.exists()) {
            return showToast(`⚠️ كود الطالب (${targetId}) مسجل مسبقاً باسم طالب آخر يدعى (${docSnap.data().name})!`, "error");
        }

        await setDoc(doc(db, "students", targetId), {
            id: targetId,
            name: targetName,
            class: targetClass,
            grades: {},
            violations: [],
            attendance: [],
            ratings: {}
        });

        showToast("🎉 تم قيد الطالب في الفايربيز وتأسيس ملفه الأكاديمي بنجاح!");
        idInput.value = "";
        nameInput.value = "";
        classInput.value = "";
        loadStudentsData("init");
    } catch (error) { showToast("❌ فشل الحفظ: " + error.message, "error"); }
});

// ==========================================
// 2. إضافة أو تحديث معلم بالـ Auth (تم إصلاح ثغرة كراش الـ SecondaryApp)
// ==========================================
const addTeacherForm = document.getElementById('addTeacherForm');
if (addTeacherForm) {
    addTeacherForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const tName = document.getElementById('teacherName').value.trim();
        const tEmail = document.getElementById('teacherEmail').value.trim();
        const tPassword = document.getElementById('teacherPassword').value.trim();

        const checkedClasses = document.querySelectorAll('input[name="teacherClasses"]:checked');
        const checkedSubjects = document.querySelectorAll('input[name="teacherSubjects"]:checked');

        const tClassesArray = Array.from(checkedClasses).map(cb => cb.value);
        const tSubjectsArray = Array.from(checkedSubjects).map(cb => cb.value);

        if (tClassesArray.length === 0 || tSubjectsArray.length === 0) {
            return showToast("⚠️ يجب اختيار مادة واحدة وفصل واحد على الأقل للمعلم!", "error");
        }

        if (editingTeacherId) {
            try {
                await updateDoc(doc(db, "users", editingTeacherId), {
                    name: tName,
                    subject: tSubjectsArray,
                    class: tClassesArray
                });
                showToast(`🎉 تم تحديث بيانات المعلم بنجاح!`);

                editingTeacherId = null;
                document.getElementById('teacherEmail').disabled = false;
                const passField = document.getElementById('teacherPassword');
                if (passField) {
                    passField.disabled = false;
                    passField.placeholder = "كلمة المرور";
                }

                const submitBtn = document.querySelector('#addTeacherForm button[type="submit"]');
                if (submitBtn) {
                    submitBtn.innerHTML = "حفظ المعلم وتسجيل الحساب";
                    submitBtn.style.background = "";
                }
                addTeacherForm.reset();
                loadTeachersData("init");
            } catch (error) { showToast("❌ خطأ أثناء تحديث البيانات: " + error.message, "error"); }
            return;
        }

        try {
            // حل ذكي: نتأكد هل الـ SecondaryApp تم إنشاؤه من قبل لتفادي الـ Crash
            const secondaryApp = getApps().find(app => app.name === "SecondaryApp") || initializeApp(firebaseConfig, "SecondaryApp");
            const secondaryAuth = getAuth(secondaryApp);

            const userCredential = await createUserWithEmailAndPassword(secondaryAuth, tEmail, tPassword);
            const teacherUser = userCredential.user;

            await setDoc(doc(db, "users", teacherUser.uid), {
                name: tName,
                email: tEmail,
                subject: tSubjectsArray,
                class: tClassesArray,
                role: "teacher"
            });

            await secondaryAuth.signOut();
            showToast(`✅ تم تسجيل المعلم وتكريت حسابه بنجاح!`);
            addTeacherForm.reset();
            loadTeachersData("init");
        } catch (error) { showToast("❌ حدث خطأ أثناء الحفظ: " + error.message, "error"); }
    });
}

// ==========================================
// 3. رصد الدرجات لولي الأمر
// ==========================================
document.getElementById('saveGradeBtn')?.addEventListener('click', async () => {
    const idInput = document.getElementById('targetStuId');
    const subInput = document.getElementById('subject');
    const gradeInput = document.getElementById('grade');

    if (!idInput.value || !subInput.value || !gradeInput.value) return showToast("برجاء تحديد كود الطالب، المادة والدرجة", "error");
    try {
        const gradeVal = parseFloat(gradeInput.value);
        const updateData = {};
        updateData[`grades.${subInput.value}`] = gradeVal;

        await updateDoc(doc(db, "students", idInput.value), updateData);
        showToast("تم رصد الدرجة بنجاح!");
        gradeInput.value = "";
    } catch (e) { showToast("خطأ: " + e.message, "error"); }
});

// ==========================================
// 4. تسجيل مخالفة سلوكية
// ==========================================
document.getElementById('saveViolationBtn')?.addEventListener('click', async () => {
    const idInput = document.getElementById('targetStuId');
    const titleInput = document.getElementById('vTitle');
    const detailsInput = document.getElementById('vDetails');

    if (!idInput.value || !titleInput.value) return showToast("برجاء إدخال كود الطالب وعنوان المخالفة", "error");
    try {
        await updateDoc(doc(db, "students", idInput.value), {
            violations: arrayUnion({
                title: titleInput.value,
                details: detailsInput.value,
                date: new Date().toLocaleDateString()
            })
        });
        showToast("تم تسجيل المخالفة بنجاح!");
        titleInput.value = "";
        detailsInput.value = "";
        idInput.value = "";
    } catch (e) { showToast("خطأ: " + e.message, "error"); }
});

// ==========================================
// 5. احتساب أعلى 10 طلاب
// ==========================================
document.getElementById('getTop10Btn')?.addEventListener('click', async () => {
    try {
        const querySnapshot = await getDocs(collection(db, "students"));
        let studentList = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            let sum = 0;
            for (let sub in data.grades) { sum += data.grades[sub]; }
            studentList.push({ name: data.name, id: data.id, total: sum });
        });
        studentList.sort((a, b) => b.total - a.total);
        const top10 = studentList.slice(0, 10);
        const tbody = document.getElementById('top10TableBody');
        if (tbody) {
            tbody.innerHTML = "";
            top10.forEach((stu, idx) => {
                tbody.innerHTML += `<tr><td>${idx + 1}</td><td>${stu.id}</td><td>${stu.name}</td><td>${stu.total} درجة</td></tr>`;
            });
            showToast("تم تحديث قائمة الأوائل بنجاح!");
        }
    } catch (e) { showToast("خطأ في جلب الدفعة: " + e.message, "error"); }
});