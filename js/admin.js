// js/admin.js
import { db, firebaseConfig } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, setDoc, updateDoc, arrayUnion, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ==========================================
// 0. دالات جلب وتحديث البيانات المشتركة (الفصول والمواد والجداول) ديناميكياً
// ==========================================
async function loadAdminDynamicData() {
    try {
        // أ. جلب الفصول من كولكشن classes
        const classesSnap = await getDocs(collection(db, "classes"));
        const classesList = [];
        classesSnap.forEach(doc => classesList.push(doc.data().name));

        // ب. جلب المواد من كولكشن subjects
        const subjectsSnap = await getDocs(collection(db, "subjects"));
        const subjectsList = [];
        subjectsSnap.forEach(doc => subjectsList.push(doc.data().name));

        // 1. تحديث قائمة فصول الطلاب (Dropdown)
        const stuClassSelect = document.getElementById('stuClass');
        if (stuClassSelect) {
            stuClassSelect.innerHTML = '<option value="">-- اختر الفصل المدرسي --</option>';
            classesList.forEach(cls => {
                stuClassSelect.innerHTML += `<option value="${cls}">فصل ${cls}</option>`;
            });
        }

        // 2. تحديث قائمة المواد في قسم رصد الدرجات (Dropdown)
        const gradeSubjectSelect = document.getElementById('subject');
        if (gradeSubjectSelect) {
            gradeSubjectSelect.innerHTML = '<option value="">-- اختر المادة المراد رصدها --</option>';
            subjectsList.forEach(sub => {
                gradeSubjectSelect.innerHTML += `<option value="${sub}">${sub}</option>`;
            });
        }

        // 3. حقن الفصول كـ كروت أنيقة لإضافة معلم (محدثة لمنع التداخل)
        const teacherClassesContainer = document.getElementById('teacherClassesContainer');
        if (teacherClassesContainer) {
            teacherClassesContainer.innerHTML = classesList.length === 0 ? '<span style="color:#94a3b8; font-size:13px; grid-column: 1/-1;">⚠️ لا توجد فصول، أضف فصولاً من الأعلى أولاً</span>' : '';
            classesList.forEach(cls => {
                teacherClassesContainer.innerHTML += `
                    <label style="display: flex !important; align-items: center !important; gap: 10px !important; padding: 10px 12px !important; background: #ffffff !important; border: 1px solid #e2e8f0 !important; border-radius: 6px !important; cursor: pointer !important; transition: all 0.2s !important; box-shadow: 0 1px 3px rgba(0,0,0,0.05) !important; user-select: none !important; width: 100% !important; box-sizing: border-box !important; direction: rtl !important; float: none !important;">
                        <input type="checkbox" name="teacherClasses" value="${cls}" style="accent-color: #2563eb !important; transform: scale(1.2) !important; margin: 0 !important; float: none !important; cursor: pointer !important; min-width: 16px !important; min-height: 16px !important;">
                        <span style="font-size: 13.5px !important; font-weight: 600 !important; color: #334155 !important; white-space: nowrap !important; float: none !important; margin: 0 !important; line-height: 1 !important;">فصل ${cls}</span>
                    </label>
                `;
            });
        }

        // 4. حقن المواد كـ كروت أنيقة لإضافة معلم (محدثة لمنع التداخل)
        const teacherSubjectsContainer = document.getElementById('teacherSubjectsContainer');
        if (teacherSubjectsContainer) {
            teacherSubjectsContainer.innerHTML = subjectsList.length === 0 ? '<span style="color:#94a3b8; font-size:13px; grid-column: 1/-1;">⚠️ لا توجد مواد، أضف مواداً من الأعلى أولاً</span>' : '';
            subjectsList.forEach(sub => {
                teacherSubjectsContainer.innerHTML += `
                    <label style="display: flex !important; align-items: center !important; gap: 10px !important; padding: 10px 12px !important; background: #ffffff !important; border: 1px solid #e2e8f0 !important; border-radius: 6px !important; cursor: pointer !important; transition: all 0.2s !important; box-shadow: 0 1px 3px rgba(0,0,0,0.05) !important; user-select: none !important; width: 100% !important; box-sizing: border-box !important; direction: rtl !important; float: none !important;">
                        <input type="checkbox" name="teacherSubjects" value="${sub}" style="accent-color: #2563eb !important; transform: scale(1.2) !important; margin: 0 !important; float: none !important; cursor: pointer !important; min-width: 16px !important; min-height: 16px !important;">
                        <span style="font-size: 13.5px !important; font-weight: 600 !important; color: #334155 !important; white-space: nowrap !important; float: none !important; margin: 0 !important; line-height: 1 !important;">${sub}</span>
                    </label>
                `;
            });
        }

        // 5. تحديث جدول المواد المتاحة أسفل الصفحة
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

        // 6. تحديث جدول المعلمين المقيدين بالنظام
        const teachersTableBody = document.getElementById('teachersTableBody');
        if (teachersTableBody) {
            const usersSnap = await getDocs(collection(db, "users"));
            teachersTableBody.innerHTML = "";
            let hasTeachers = false;

            usersSnap.forEach(doc => {
                const userData = doc.data();
                if (userData.role === "teacher") {
                    hasTeachers = true;
                    // دعم قراءة المصفوفات والتحويل لنصوص منسقة للعرض بالشارات
                    const subDisplay = Array.isArray(userData.subject) ? userData.subject.join(' ، ') : (userData.subject || "غير محدد");
                    const clsDisplay = Array.isArray(userData.class) ? userData.class.join(' ، ') : (userData.class || "غير محدد");

                    teachersTableBody.innerHTML += `
                        <tr style="border-bottom: 1px solid #e2e8f0;">
                            <td style="padding:12px; font-weight:600; color:#1e293b;">${userData.name || 'بدون اسم'}</td>
                            <td style="padding:12px; color:#475569; font-size:14px;">${userData.email}</td>
                            <td style="padding:12px;"><span style="background:#eff6ff; color:#2563eb; padding:4px 10px; border-radius:12px; font-size:12px; font-weight:600; display:inline-block;">${subDisplay}</span></td>
                            <td style="padding:12px;"><span style="background:#f0fdf4; color:#16a34a; padding:4px 10px; border-radius:12px; font-size:12px; font-weight:600; display:inline-block;">${clsDisplay}</span></td>
                        </tr>
                    `;
                }
            });

            if (!hasTeachers) {
                teachersTableBody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px; color:#94a3b8;">لا يوجد معلمون مسجلون حالياً</td></tr>';
            }
        }

    } catch (e) {
        console.error("حدث خطأ أثناء تحميل البيانات اللحظية للوحة:", e);
    }
}

// تشغيل الفحص والتحميل بمجرد فتح الصفحة فوراً
document.addEventListener('DOMContentLoaded', loadAdminDynamicData);


// ==========================================
// 0.5 أكواد حفظ الفصول والمواد الجديدة
// ==========================================
document.getElementById('addClassBtn')?.addEventListener('click', async () => {
    const classInput = document.getElementById('newClassName');
    const className = classInput.value.trim();

    if (!className) return alert("برجاء إدخال اسم الفصل أولاً");

    try {
        await setDoc(doc(db, "classes", className), { name: className });
        alert(`🎉 تم حفظ وتثبيت الفصل (${className}) بنجاح في قاعدة البيانات!`);
        classInput.value = "";
        await loadAdminDynamicData(); // ريفرش فوري للقوائم والجداول بدون تحميل الصفحة
    } catch (e) { alert("خطأ أثناء حفظ الفصل: " + e.message); }
});

document.getElementById('addSubjectBtn')?.addEventListener('click', async () => {
    const subjectInput = document.getElementById('newSubjectName');
    const subjectName = subjectInput.value.trim();

    if (!subjectName) return alert("برجاء إدخال اسم المادة أولاً");

    try {
        await setDoc(doc(db, "subjects", subjectName), { name: subjectName });
        alert(`🎉 تم حفظ وتثبيت المادة (${subjectName}) بنجاح في قاعدة البيانات!`);
        subjectInput.value = "";
        await loadAdminDynamicData(); // ريفرش فوري للقوائم والجداول
    } catch (e) { alert("خطأ أثناء حفظ المادة: " + e.message); }
});


// ==========================================
// 1. إضافة طالب جديد وتأسيس بياناته
// ==========================================
document.getElementById('addStudentBtn')?.addEventListener('click', async () => {
    const idInput = document.getElementById('stuId');
    const nameInput = document.getElementById('stuName');
    const classInput = document.getElementById('stuClass');

    if (!idInput.value || !nameInput.value || !classInput.value) return alert("برجاء إدخال البيانات كاملة وتحديد الفصل");

    try {
        await setDoc(doc(db, "students", idInput.value), {
            id: idInput.value,
            name: nameInput.value,
            class: classInput.value,
            grades: {},
            violations: [],
            attendance: [],
            ratings: {}
        });

        alert("🎉 عظَمة! تم حفظ الطالب في الفايربيز وتأسيس الـ Collection بنجاح!");
        idInput.value = "";
        nameInput.value = "";

    } catch (error) {
        alert("❌ الفايربيز رفض الحفظ! نص الخطأ: " + error.message);
    }
});


// ==========================================
// 2. إضافة معلم جديد وتكريت حسابه (يدعم الـ Arrays للاختيارات المتعددة)
// ==========================================
const addTeacherForm = document.getElementById('addTeacherForm');

if (addTeacherForm) {
    addTeacherForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const tName = document.getElementById('teacherName').value.trim();
        const tEmail = document.getElementById('teacherEmail').value.trim();
        const tPassword = document.getElementById('teacherPassword').value.trim();

        // تجميع الاختيارات المتعددة من الـ Checkboxes
        const checkedClasses = document.querySelectorAll('input[name="teacherClasses"]:checked');
        const checkedSubjects = document.querySelectorAll('input[name="teacherSubjects"]:checked');

        const tClassesArray = Array.from(checkedClasses).map(cb => cb.value);
        const tSubjectsArray = Array.from(checkedSubjects).map(cb => cb.value);

        if (tClassesArray.length === 0 || tSubjectsArray.length === 0) {
            return alert("⚠️ يجب اختيار مادة واحدة وفصل واحد على الأقل للمعلم الجديد!");
        }

        try {
            // 🔥 الحيلة الذكية لحماية جلسة الآدمن الحالية من الخروج
            const secondaryApp = initializeApp(firebaseConfig, "SecondaryApp");
            const secondaryAuth = getAuth(secondaryApp);

            // أ. إنشاء حساب المدرس في Firebase Auth
            const userCredential = await createUserWithEmailAndPassword(secondaryAuth, tEmail, tPassword);
            const teacherUser = userCredential.user;

            // ب. حفظ المدرس بالمصفوفات (Arrays) لتغطية المواد والفصول المتعددة
            await setDoc(doc(db, "users", teacherUser.uid), {
                name: tName,
                email: tEmail,
                subject: tSubjectsArray, // مصفوفة المواد
                class: tClassesArray,   // مصفوفة الفصول
                role: "teacher"
            });

            await secondaryAuth.signOut();

            alert(`✅ تم تسجيل المعلم (${tName}) وتكريت حسابه بنجاح!`);
            addTeacherForm.reset();
            await loadAdminDynamicData(); // تحديث فوري لجدول المعلمين تحت

        } catch (error) {
            if (error.code === 'auth/email-already-in-use') {
                alert("❌ هذا البريد الإلكتروني مسجل بالفعل لمستخدم آخر!");
            } else {
                alert("❌ حدث خطأ أثناء الحفظ: " + error.message);
            }
        }
    });
}


// ==========================================
// 3. رصد الدرجات لولي الأمر
// ==========================================
document.getElementById('saveGradeBtn')?.addEventListener('click', async () => {
    const idInput = document.getElementById('targetStuId');
    const subInput = document.getElementById('subject');
    const gradeInput = document.getElementById('grade');

    if (!idInput.value || !subInput.value || !gradeInput.value) return alert("برجاء تحديد كود الطالب، المادة والدرجة");

    try {
        const gradeVal = parseFloat(gradeInput.value);
        const updateData = {};
        updateData[`grades.${subInput.value}`] = gradeVal;

        await updateDoc(doc(db, "students", idInput.value), updateData);
        alert("تم رصد الدرجة بنجاح!");
        gradeInput.value = "";

    } catch (e) { alert("خطأ: " + e.message); }
});


// ==========================================
// 4. تسجيل مخالفة سلوكية
// ==========================================
document.getElementById('saveViolationBtn')?.addEventListener('click', async () => {
    const idInput = document.getElementById('targetStuId');
    const titleInput = document.getElementById('vTitle');
    const detailsInput = document.getElementById('vDetails');

    if (!idInput.value || !titleInput.value) return alert("برجاء إدخال كود الطالب وعنوان المخالفة");

    try {
        await updateDoc(doc(db, "students", idInput.value), {
            violations: arrayUnion({
                title: titleInput.value,
                details: detailsInput.value,
                date: new Date().toLocaleDateString()
            })
        });
        alert("تم تسجيل المخالفة بنجاح!");
        titleInput.value = "";
        detailsInput.value = "";
        idInput.value = "";

    } catch (e) { alert("خطأ: " + e.message); }
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
        tbody.innerHTML = "";
        top10.forEach((stu, idx) => {
            tbody.innerHTML += `<tr><td>${idx + 1}</td><td>${stu.id}</td><td>${stu.name}</td><td>${stu.total} درجة</td></tr>`;
        });
    } catch (e) { alert("خطأ في جلب الدفعة: " + e.message); }
});