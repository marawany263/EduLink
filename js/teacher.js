// js/teacher.js
import { db } from "./firebase-config.js";
import { collection, query, where, getDocs, doc, getDoc, updateDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ربط العناصر بالـ IDs الصحيحة والمطابقة للـ HTML
const classSelect = document.getElementById('classSelect');
const displayBtn = document.getElementById('loadClassBtn'); 
const studentsTableBody = document.getElementById('studentsTableBody');
const teacherNameEl = document.getElementById('teacherName');
const teacherSubjectEl = document.getElementById('teacherSubject');


if (!localStorage.getItem('currentTeacherId')) {
    window.location.replace('index.html');
}

document.getElementById('logoutBtn')?.addEventListener('click', () => {
    if (confirm("هل أنت متأكد من رغبتك في تسجيل الخروج من منصة EduLink؟")) {
        localStorage.removeItem('currentTeacherId');
        window.location.replace('index.html'); // يمسح السجل ويمنع الرجوع لورا
    }
});
// ==========================================
// 1. جلب بيانات المعلم وتجهيز القائمة ديناميكياً فور فتح الصفحة
// ==========================================
async function initTeacherDashboard() {
    // جلب كود المدرس الحالي المخزن في الـ localStorage عند تسجيل الدخول
    const currentTeacherId = localStorage.getItem('currentTeacherId');
    
    if (!currentTeacherId) {
        if(teacherNameEl) teacherNameEl.innerText = "⚠️ لم يتم التعرف على المعلم (سجل دخول أولاً)";
        return;
    }

    try {
        // قراءة مستند المعلم من كولكشن users الرئيسي
        const teacherDocRef = doc(db, "users", currentTeacherId);
        const teacherSnap = await getDoc(teacherDocRef);

        if (teacherSnap.exists()) {
            const teacherData = teacherSnap.data();

            // التحقق الأمني من صلاحية الحساب
            if (teacherData.role !== "teacher") {
                if(teacherNameEl) teacherNameEl.innerText = "⚠️ هذا الحساب ليس مسجلاً كمعلم في النظام";
                return;
            }

            // طباعة الاسم والمادة في الهيدر الترحيبي
            if(teacherNameEl) teacherNameEl.innerText = teacherData.name || "معلم بدون اسم";
            if(teacherSubjectEl) teacherSubjectEl.innerText = `📚 مادة: ${teacherData.subject || "غير محددة"}`;

            // تجهيز قائمة الفصول بناءً على حقل class (سواء كان نصاً فرداً أو مصفوفة)
            if(classSelect) {
                classSelect.innerHTML = '<option value="">-- اختر الفصل من فصولك المتاحة --</option>';
                
                if (teacherData.class) {
                    if (Array.isArray(teacherData.class)) {
                        teacherData.class.forEach(className => {
                            classSelect.innerHTML += `<option value="${className}">فصل ${className}</option>`;
                        });
                    } else {
                        // لو كان الحساب مسجل بفصل واحد كـ String مثل "B-1"
                        classSelect.innerHTML += `<option value="${teacherData.class}">فصل ${teacherData.class}</option>`;
                    }
                } else {
                    classSelect.innerHTML = '<option value="">⚠️ لا توجد فصول مسجلة لك</option>';
                }
            }
        } else {
            if(teacherNameEl) teacherNameEl.innerText = "⚠️ حساب المعلم غير موجود في قاعدة البيانات";
            console.error("المستند غير موجود في كولكشن users بالـ ID:", currentTeacherId);
        }
    } catch (error) {
        if(teacherNameEl) teacherNameEl.innerText = "⚠️ فشل الاتصال بقاعدة البيانات";
        console.error("خطأ كامل أثناء تهيئة لوحة المعلم:", error);
    }
}

// تشغيل دالة التهيئة فور تحميل الصفحة
document.addEventListener('DOMContentLoaded', initTeacherDashboard);

// تفعيل الساعة الرقمية اللحظية في النظام
function updateLiveTime() {
    const liveTimeEl = document.getElementById('liveTime');
    if (liveTimeEl) {
        const now = new Date();
        liveTimeEl.innerText = now.toLocaleDateString('ar-EG') + ' | ' + now.toLocaleTimeString('ar-EG');
    }
}
setInterval(updateLiveTime, 1000);
updateLiveTime();

// ==========================================
// 2. جلب طلاب الفصل المرفوعين من الإدارة عند الضغط على الزر
// ==========================================
displayBtn?.addEventListener('click', async () => {
    const selectedClass = classSelect.value;
    if(!selectedClass) return alert("برجاء اختيار الفصل أولاً");

    try {
        // إظهار مؤشر تحميل بسيط
        studentsTableBody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:20px;">جاري تحميل قائمة الطلاب...</td></tr>`;

        const q = query(collection(db, "students"), where("class", "==", selectedClass));
        const querySnapshot = await getDocs(q);
        
        studentsTableBody.innerHTML = "";
        
        if(querySnapshot.empty) {
            studentsTableBody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:#ef4444; padding:20px;">⚠️ لا يوجد طلاب مسجلين في هذا الفصل حالياً</td></tr>`;
            return;
        }

        querySnapshot.forEach((documentSnapshot) => {
            // جلب الـ ID الحقيقي للوثيقة (كود الطالب) والبيانات
            const studentId = documentSnapshot.id; 
            const student = documentSnapshot.data();
            
            studentsTableBody.innerHTML += `
                <tr data-id="${studentId}">
                    <td style="font-weight:bold; color:#1e293b;">${studentId}</td>
                    <td>${student.name || "اسم غير مسجل"}</td>
                    <td>
                        <label style="cursor:pointer; color:#ef4444; font-weight:bold;">
                            <input type="checkbox" class="absence-check" style="width:auto; margin-left:5px;"> غائب
                        </label>
                    </td>
                    <td>
                        <select class="teacher-rating" style="width:140px; margin:0; padding:5px; border-radius:4px;">
                            <option value="5">⭐⭐⭐⭐⭐ (5)</option>
                            <option value="4">⭐⭐⭐⭐ (4)</option>
                            <option value="3">⭐⭐⭐ (3)</option>
                            <option value="2">⭐⭐ (2)</option>
                            <option value="1">⭐ (1)</option>
                        </select>
                    </td>
                </tr>
            `;
        });
    } catch(e) { 
        alert("خطأ في جلب الطلاب: " + e.message); 
        console.error(e);
    }
});

// ==========================================
// 3. حفظ الغياب والتقييم اللحظي التراكمي للحصة في قاعدة البيانات
// ==========================================
document.getElementById('saveSessionBtn')?.addEventListener('click', async () => {
    const rows = studentsTableBody.querySelectorAll('tr');
    
    // التحقق من أن الجدول يحتوي على طلاب فعليين وليس رسائل تنبيهية
    if(rows.length === 0 || rows[0].querySelector('td').getAttribute('colspan')) {
        return alert("لا توجد قائمة طلاب نشطة لحفظها!");
    }

    const currentTeacherId = localStorage.getItem('currentTeacherId');
    if (!currentTeacherId) {
        return alert("⚠️ خطأ في صلاحيات المعلم! برجاء تسجيل الخروج وإعادة الدخول لتنشيط الحساب.");
    }

    const currentDate = new Date().toISOString().split('T')[0]; // صيغة YYYY-MM-DD
    const currentMonth = new Date().getMonth() + 1; 

    try {
        // إظهار رسالة انتظار للمدرس أثناء رفع البيانات
        const saveBtn = document.getElementById('saveSessionBtn');
        saveBtn.disabled = true;
        saveBtn.innerText = "جاري الحفظ والرفع...";

        for (let row of rows) {
            const studentId = row.getAttribute('data-id');
            if(!studentId) continue;

            const isAbsent = row.querySelector('.absence-check').checked;
            const ratingValue = parseFloat(row.querySelector('.teacher-rating').value);

            const studentRef = doc(db, "students", studentId);
            
            // 🚀 طلب موحد (Object) لتحديث البيانات دفعة واحدة بدلاً من مرتين لتسريع العملية
            const updateData = {};
            
            // أ) إذا علّم المدرس على "غائب"، يتم إضافته لمصفوفة الغياب
            if(isAbsent) {
                updateData['attendance'] = arrayUnion({ date: currentDate, month: currentMonth, status: "absent" });
            }

            // ب) تحديث التقييمات بشكل تراكمي بناءً على الـ UID الخاص بكل مدرس
            updateData[`ratings.${currentTeacherId}`] = ratingValue; 
            
            // إرسال التحديث النهائي المدمج للفايرستور
            await updateDoc(studentRef, updateData);
        }

        alert("🎉 تم تسجيل حضور وغياب الحصة ورصد التقييمات التراكمية لجميع الطلاب بنجاح، وتحديث بوابة ولي الأمر!");
        
        // إعادة تهيئة الزرار بعد النجاح
        saveBtn.disabled = false;
        saveBtn.innerText = "💾 حفظ الحصة ورصد التقييمات فوراً";

    } catch(e) { 
        alert("خطأ أثناء الحفظ: " + e.message); 
        document.getElementById('saveSessionBtn').disabled = false;
        document.getElementById('saveSessionBtn').innerText = "💾 حفظ الحصة ورصد التقييمات فوراً";
    }
});