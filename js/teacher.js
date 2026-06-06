// js/teacher.js
import { db } from "./firebase-config.js";
import { collection, query, where, getDocs, doc, getDoc, updateDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ربط العناصر بالـ IDs الصحيحة والمطابقة للـ HTML
const classSelect = document.getElementById('classSelect');
const displayBtn = document.getElementById('loadClassBtn'); 
const studentsTableBody = document.getElementById('studentsTableBody');
const searchInput = document.getElementById('searchInput');
const teacherNameEl = document.getElementById('teacherName');
const teacherSubjectEl = document.getElementById('teacherSubject');
const paginationInfo = document.getElementById('paginationInfo');
const paginationControls = document.getElementById('paginationControls');

// متغيرات الذاكرة لـ السيرش والـ Pagination اللحظي
let allStudentsData = [];      // لتخزين كل طلاب الفصل الحاليين
let filteredStudentsData = []; // للطلاب بعد الفلترة بالسيرش
let currentPage = 1;
const rowsPerPage = 5;         // عدد الطلاب المعروضين في الصفحة الواحدة

// ==========================================
// 🌟 نظام الـ Toaster المخصص بديل الـ Alert
// ==========================================
function showToast(message, type = "success") {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `custom-toast ${type}`;
    
    let icon = "🔔";
    if (type === "success") icon = "🎉";
    if (type === "error") icon = "⚠️";
    if (type === "warning") icon = "🔒";

    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
    container.appendChild(toast);
    
    // Trigger الـ Animation
    setTimeout(() => toast.classList.add('show'), 50);
    
    // تدمير التوستر بعد 4 ثواني
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 400);
    }, 4000);
}

// حماية الصفحة
if (!localStorage.getItem('currentTeacherId')) {
    window.location.replace('index.html');
}

// لوجيك تسجيل الخروج
document.getElementById('logoutBtn')?.addEventListener('click', () => {
    if (confirm("هل أنت متأكد من رغبتك في تسجيل الخروج من منصة EduLink؟")) {
        localStorage.removeItem('currentTeacherId');
        window.location.replace('index.html'); 
    }
});

// ==========================================
// 1. جلب بيانات المعلم وتجهيز القائمة ديناميكياً
// ==========================================
async function initTeacherDashboard() {
    const currentTeacherId = localStorage.getItem('currentTeacherId');
    if (!currentTeacherId) return;

    try {
        const teacherDocRef = doc(db, "users", currentTeacherId);
        const teacherSnap = await getDoc(teacherDocRef);

        if (teacherSnap.exists()) {
            const teacherData = teacherSnap.data();

            if (teacherData.role !== "teacher") {
                if(teacherNameEl) teacherNameEl.innerText = "⚠️ هذا الحساب ليس مسجلاً كمعلم";
                return;
            }

            if(teacherNameEl) teacherNameEl.innerText = teacherData.name || "معلم بدون اسم";
            
            if(teacherSubjectEl) {
                const subjectDisplay = Array.isArray(teacherData.subject) ? teacherData.subject.join(' ، ') : (teacherData.subject || "غير محددة");
                teacherSubjectEl.innerText = `📚 مادة: ${subjectDisplay}`;
            }

            if(classSelect) {
                classSelect.innerHTML = '<option value="">-- اختر الفصل من فصولك المتاحة --</option>';
                if (teacherData.class) {
                    if (Array.isArray(teacherData.class)) {
                        teacherData.class.forEach(className => {
                            classSelect.innerHTML += `<option value="${className}">فصل ${className}</option>`;
                        });
                    } else {
                        classSelect.innerHTML += `<option value="${teacherData.class}">فصل ${teacherData.class}</option>`;
                    }
                } else {
                    classSelect.innerHTML = '<option value="">⚠️ لا توجد فصول مسجلة لك</option>';
                }
            }
        }
    } catch (error) {
        showToast("فشل الاتصال بقاعدة البيانات أثناء التهيئة", "error");
    }
}

// تشغيل ميزات الصفحة
document.addEventListener('DOMContentLoaded', () => {
    initTeacherDashboard();
    
    // تفعيل زرار تحديد الكل غائب / حاضر (Toggle) خارج الجدول
    document.getElementById('toggleAllAbsenceBtn')?.addEventListener('click', (e) => {
        const btn = e.target;
        const currentState = btn.getAttribute('data-state');
        const absenceChecks = document.querySelectorAll('.absence-check');
        
        if (absenceChecks.length === 0) return showToast("لا توجد قائمة طلاب نشطة حالياً!", "warning");

        if (currentState === "none" || currentState === "") {
            absenceChecks.forEach(cb => cb.checked = true);
            btn.setAttribute('data-state', 'all');
            btn.innerText = "✅ إلغاء تحديد غياب الكل";
            btn.style.backgroundColor = "#fef2f2";
            btn.style.color = "#ef4444";
            btn.style.borderColor = "#fca5a5";
        } else {
            absenceChecks.forEach(cb => cb.checked = false);
            btn.setAttribute('data-state', 'none');
            btn.innerText = "🚫 تحديد الكل كـ غائب";
            btn.style.backgroundColor = "#f8fafc";
            btn.style.color = "#64748b";
            btn.style.borderColor = "#cbd5e1";
        }
    });

    // 🌟 تفعيل الـ Live Search الفوري أثناء الكتابة
    searchInput?.addEventListener('input', (e) => {
        const searchTerm = e.target.value.trim().toLowerCase();
        
        if(!searchTerm) {
            filteredStudentsData = [...allStudentsData];
        } else {
            filteredStudentsData = allStudentsData.filter(student => 
                student.id.toLowerCase().includes(searchTerm) || 
                (student.name && student.name.toLowerCase().includes(searchTerm))
            );
        }
        currentPage = 1; // تصفير الصفحة للأولى عند البحث
        renderStudentsTable();
    });
});

// تفعيل الساعة اللحظية
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
// 2. جلب طلاب الفصل بالكامل وحفظهم في الذاكرة
// ==========================================
displayBtn?.addEventListener('click', async () => {
    const selectedClass = classSelect.value;
    if(!selectedClass) return showToast("برجاء اختيار الفصل أولاً", "warning");

    try {
        studentsTableBody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:20px;">جاري تحميل قائمة الطلاب...</td></tr>`;
        if(searchInput) searchInput.disabled = true;
        
        const toggleAllBtn = document.getElementById('toggleAllAbsenceBtn');
        if (toggleAllBtn) {
            toggleAllBtn.setAttribute('data-state', 'none');
            toggleAllBtn.innerText = "🚫 تحديد الكل كـ غائب";
            toggleAllBtn.style.backgroundColor = "#f8fafc";
            toggleAllBtn.style.color = "#64748b";
            toggleAllBtn.style.borderColor = "#cbd5e1";
        }

        const q = query(collection(db, "students"), where("class", "==", selectedClass));
        const querySnapshot = await getDocs(q);
        
        allStudentsData = []; // تصفير المصفوفة القديمة
        
        if(querySnapshot.empty) {
            studentsTableBody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:#ef4444; padding:20px;">⚠️ لا يوجد طلاب مسجلين في هذا الفصل حالياً</td></tr>`;
            paginationInfo.innerText = "عرض 0 من أصل 0 طالب";
            paginationControls.innerHTML = "";
            return;
        }

        querySnapshot.forEach((docSnap) => {
            allStudentsData.push({
                id: docSnap.id,
                ...docSnap.data()
            });
        });

        if(searchInput) {
            searchInput.disabled = false;
            searchInput.value = ""; // تصفير خانة البحث
        }
        
        filteredStudentsData = [...allStudentsData];
        currentPage = 1;
        renderStudentsTable(); // تشغيل دالة العرض والترقيم المخصصة
        showToast(`تم تحميل ${allStudentsData.length} طالب بنجاح!`, "success");

    } catch(e) { 
        showToast("خطأ في جلب الطلاب: " + e.message, "error"); 
    }
});

// ==========================================
// 🌟 دالة عرض الجدول والتحكم في الـ Pagination
// ==========================================
function renderStudentsTable() {
    const currentTeacherId = localStorage.getItem('currentTeacherId');
    const currentDate = new Date().toISOString().split('T')[0];

    studentsTableBody.innerHTML = "";

    if (filteredStudentsData.length === 0) {
        studentsTableBody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:#64748b; padding:20px;">⚠️ لا توجد نتائج مطابقة للبحث</td></tr>`;
        paginationInfo.innerText = "عرض 0 من أصل 0 طالب";
        paginationControls.innerHTML = "";
        return;
    }

    // حسابات الـ Pagination الرياضية للمصفوفة
    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = Math.min(startIndex + rowsPerPage, filteredStudentsData.length);
    const paginatedItems = filteredStudentsData.slice(startIndex, startIndex + rowsPerPage);

    paginatedItems.forEach((student) => {
        let isAbsentToday = false;
        if (Array.isArray(student.attendance)) {
            isAbsentToday = student.attendance.some(record => record.date === currentDate && record.status === "absent");
        }

        const savedRating = (student.ratings && student.ratings[currentTeacherId]) ? student.ratings[currentTeacherId] : 5;
        
        // 🌟 حفظ القيم اللحظية المدخلة مباشرة في الكائن عند التغيير لكي لا تضيع أثناء التنقل بين الصفحات
        studentsTableBody.innerHTML += `
            <tr data-id="${student.id}">
                <td style="font-weight:bold; color:#1e293b; padding: 12px;">${student.id}</td>
                <td style="padding: 12px;">${student.name || "اسم غير مسجل"}</td>
                <td style="padding: 12px; text-align: center;">
                    <label style="cursor:pointer; color:#ef4444; font-weight:bold; display: inline-flex; align-items: center; gap: 5px;">
                        <input type="checkbox" class="absence-check" style="transform: scale(1.1); accent-color: #ef4444;" ${isAbsentToday ? 'checked' : ''} onchange="this.closest('tr').setAttribute('data-changed', 'true')"> غائب
                    </label>
                </td>
                <td style="padding: 12px;">
                    <select class="teacher-rating" style="width:140px; padding:6px; border-radius:6px; border: 1px solid #cbd5e1; background: #f8fafc; font-family: 'Cairo';" onchange="this.closest('tr').setAttribute('data-changed', 'true')">
                        <option value="5" ${savedRating === 5 ? 'selected' : ''}>⭐⭐⭐⭐⭐ (5)</option>
                        <option value="4" ${savedRating === 4 ? 'selected' : ''}>⭐⭐⭐⭐ (4)</option>
                        <option value="3" ${savedRating === 3 ? 'selected' : ''}>⭐⭐⭐ (3)</option>
                        <option value="2" ${savedRating === 2 ? 'selected' : ''}>⭐⭐ (2)</option>
                        <option value="1" ${savedRating === 1 ? 'selected' : ''}>⭐ (1)</option>
                    </select>
                </td>
            </tr>
        `;
    });

    // تحديث نص معلومات العرض
    paginationInfo.innerText = `عرض ${startIndex + 1} - ${endIndex} من أصل ${filteredStudentsData.length} طالب`;

    // بناء أزرار التحكم في الترقيم ديناميكياً
    const totalPages = Math.ceil(filteredStudentsData.length / rowsPerPage);
    paginationControls.innerHTML = "";

    if(totalPages > 1) {
        // زر الصفحة السابقة
        const prevBtn = document.createElement('button');
        prevBtn.className = "pagination-btn";
        prevBtn.innerText = "السابق";
        prevBtn.disabled = currentPage === 1;
        prevBtn.addEventListener('click', () => { saveCurrentPageState(); currentPage--; renderStudentsTable(); });
        paginationControls.appendChild(prevBtn);

        // أرقام الصفحات
        for(let i = 1; i <= totalPages; i++) {
            const pageBtn = document.createElement('button');
            pageBtn.className = `pagination-btn ${currentPage === i ? 'active' : ''}`;
            pageBtn.innerText = i;
            pageBtn.addEventListener('click', () => { saveCurrentPageState(); currentPage = i; renderStudentsTable(); });
            paginationControls.appendChild(pageBtn);
        }

        // زر الصفحة التالية
        const nextBtn = document.createElement('button');
        nextBtn.className = "pagination-btn";
        nextBtn.innerText = "التالي";
        nextBtn.disabled = currentPage === totalPages;
        nextBtn.addEventListener('click', () => { saveCurrentPageState(); currentPage++; renderStudentsTable(); });
        paginationControls.appendChild(nextBtn);
    }
}

// 🌟 دالة مساعدة لحفظ تعديلات المدرس الحالية في الذاكرة المحلية قبل الانتقال لصفحة أخرى أو فلترة السيرش
function saveCurrentPageState() {
    const rows = studentsTableBody.querySelectorAll('tr');
    rows.forEach(row => {
        const id = row.getAttribute('data-id');
        if(!id) return;
        const isAbsent = row.querySelector('.absence-check')?.checked;
        const rating = parseFloat(row.querySelector('.teacher-rating')?.value);
        const currentTeacherId = localStorage.getItem('currentTeacherId');
        
        // تحديث الكائن المخزن في مصفوفات الذاكرة الرئيسية
        const updateInArray = (arr) => {
            const index = arr.findIndex(s => s.id === id);
            if(index !== -1) {
                if(!arr[index].ratings) arr[index].ratings = {};
                arr[index].ratings[currentTeacherId] = rating;
                
                if(!arr[index].attendance) arr[index].attendance = [];
                const currentDate = new Date().toISOString().split('T')[0];
                const currentMonth = new Date().getMonth() + 1;
                
                // تنظيف التاريخ الحالي لو موجود عشان نحدثه بالجديد
                arr[index].attendance = arr[index].attendance.filter(r => r.date !== currentDate);
                if(isAbsent) {
                    arr[index].attendance.push({ date: currentDate, month: currentMonth, status: "absent" });
                }
            }
        };
        updateInArray(allStudentsData);
        updateInArray(filteredStudentsData);
    });
}

// ==========================================
// 3. حفظ الغياب والتقييم النهائي الشامل في الفايرستور
// ==========================================
document.getElementById('saveSessionBtn')?.addEventListener('click', async () => {
    saveCurrentPageState(); // التأكد من حفظ الحالة الأخيرة المفتوحة بالكامل

    if(allStudentsData.length === 0) {
        return showToast("لا توجد قائمة طلاب نشطة لحفظها!", "warning");
    }

    const currentTeacherId = localStorage.getItem('currentTeacherId');
    const currentDate = new Date().toISOString().split('T')[0]; 
    const currentMonth = new Date().getMonth() + 1; 

    try {
        const saveBtn = document.getElementById('saveSessionBtn');
        saveBtn.disabled = true;
        saveBtn.innerText = "جاري رفع البيانات التراكمية...";

        // الحفظ بيلف على مصفوفة الـ memory بالكامل، يعني هيحفظ كل الصفحات والطلاب حتى لو متفلترين!
        for (let student of allStudentsData) {
            const studentRef = doc(db, "students", student.id);
            const updateData = {};
            
            // جلب الداتا الطازجة من السيرفر لمنع تداخل حقل المصفوفات
            const studentSnap = await getDoc(studentRef);
            const serverAttendance = studentSnap.exists() ? (studentSnap.data().attendance || []) : [];
            
            // فحص هل المدرس معلم عليه غايب في الذاكرة اللحظية؟
            const isAbsentInMemory = student.attendance ? student.attendance.some(r => r.date === currentDate && r.status === "absent") : false;
            const alreadyRecordedOnServer = serverAttendance.some(r => r.date === currentDate && r.status === "absent");

            if(isAbsentInMemory) {
                if (!alreadyRecordedOnServer) {
                    updateData['attendance'] = arrayUnion({ date: currentDate, month: currentMonth, status: "absent" });
                }
            } else {
                if (alreadyRecordedOnServer) {
                    const filteredAttendance = serverAttendance.filter(r => !(r.date === currentDate && r.status === "absent"));
                    updateData['attendance'] = filteredAttendance;
                }
            }

            // حقن التقييم بالـ UID الخاص بالمعلم
            const currentRatingValue = (student.ratings && student.ratings[currentTeacherId]) ? student.ratings[currentTeacherId] : 5;
            updateData[`ratings.${currentTeacherId}`] = currentRatingValue; 
            
            await updateDoc(studentRef, updateData);
        }

        showToast("🎉 تم رصد غياب الفصل والتقييمات التراكمية لجميع الصفحات بنجاح!", "success");
        saveBtn.disabled = false;
        saveBtn.innerText = "💾 تسجيل الغياب ورصد التقييمات فوراً";

    } catch(e) { 
        showToast("خطأ أثناء الحفظ: " + e.message, "error"); 
        document.getElementById('saveSessionBtn').disabled = false;
        document.getElementById('saveSessionBtn').innerText = "💾 تسجيل الغياب ورصد التقييمات فوراً";
    }
});