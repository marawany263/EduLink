// js/parent.js
import { db } from "./firebase-config.js";
import { doc, onSnapshot, collection, query } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// قراءة كود الطالب الخاص بولي الأمر المسجل دخوله حالياً أوتوماتيكياً
const currentStudentId = localStorage.getItem('currentStudentId'); 

if (!currentStudentId) {
    alert("⚠️ غير مسموح بالدخول المباشر! برجاء تسجيل الدخول أولاً.");
    window.location.href = "index.html";
}

// دالة احترافية لتوليد نجوم التقييم بدقة الكسور (ربع، نصف، إلخ) باستخدام SVG Gradients
function generateStarsHtml(rating) {
    let starsHtml = `<div style="display: flex; gap: 6px; justify-content: center; direction: ltr; margin: 10px 0;">`;
    for (let i = 1; i <= 5; i++) {
        if (rating >= i) {
            // نجمة كاملة ممتلئة باللون الأصفر الدفء
            starsHtml += `<svg width="28" height="28" viewBox="0 0 24 24"><path fill="#eab308" d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>`;
        } else if (rating > i - 1) {
            // نجمة ممتلئة جزئياً بناءً على الكسر المتبقي (ربع، نص، إلخ)
            const fillPercentage = Math.round((rating - (i - 1)) * 100);
            const gradId = `star-grad-${fillPercentage}-${Math.random().toString(36).substring(2, 6)}`;
            starsHtml += `
            <svg width="28" height="28" viewBox="0 0 24 24">
                <defs>
                    <linearGradient id="${gradId}" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="${fillPercentage}%" stop-color="#eab308" />
                        <stop offset="${fillPercentage}%" stop-color="#cbd5e1" />
                    </linearGradient>
                </defs>
                <path fill="url(#${gradId})" d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
            </svg>`;
        } else {
            // نجمة فارغة باللون الرمادي المحايد
            starsHtml += `<svg width="28" height="28" viewBox="0 0 24 24"><path fill="#cbd5e1" d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>`;
        }
    }
    starsHtml += `</div>`;
    return starsHtml;
}

// دالة تشغيل مراقبة لوحة تحكم ولي الأمر لحظياً
function watchParentDashboard() {
    const docRef = doc(db, "students", currentStudentId);

    // 1. الاستماع اللحظي لبيانات الطالب الحالي (تحديث تلقائي عند أي تعديل)
    onSnapshot(docRef, (docSnap) => {
        if (!docSnap.exists()) {
            document.getElementById('studentName').innerText = "خطأ: الطالب غير مسجل!";
            return;
        }

        const data = docSnap.data();

        // عرض الاسم والفصل في الهيدر الرئيسي
        document.getElementById('studentName').innerText = data.name || "اسم الطالب غير مسجل";
        document.getElementById('studentClass').innerText = "الفصل: " + (data.class || "--");

        // حساب متوسط الـ Rating اللحظي من كل المدرسين
        const ratingsMap = data.ratings || {};
        const ratingKeys = Object.keys(ratingsMap);
        
        const ratingStarsEl = document.getElementById('ratingStars');
        const ratingTextEl = document.getElementById('ratingText');
        
        if (ratingTextEl) ratingTextEl.style.backgroundColor = "";

        if (ratingKeys.length === 0) {
            // إذا لم يتم التقييم بعد من أي مدرس
            if (ratingStarsEl) ratingStarsEl.innerText = "⏳"; 
            if (ratingTextEl) {
                ratingTextEl.className = "badge";
                ratingTextEl.style.backgroundColor = "#64748b"; 
                ratingTextEl.innerText = "لا يوجد أي تقييم لهذا الطالب حالياً";
            }
        } else {
            // حساب المتوسط بدقة
            let sum = 0;
            ratingKeys.forEach(key => sum += ratingsMap[key]);
            const avgRating = (sum / ratingKeys.length).toFixed(1);
            const avgNum = Number(avgRating);

            // استدعاء دالة رسم النجوم الذكية بالكسور
            if (ratingStarsEl) {
                ratingStarsEl.innerHTML = generateStarsHtml(avgNum);
            }

            // تطبيق الشروط على النصوص والـ Badges
            if (avgNum <= 2.5) {
                if (ratingTextEl) {
                    ratingTextEl.className = "badge weak";
                    ratingTextEl.innerText = `ضعيف (${avgRating})`;
                }
            } else if (avgNum >= 2.6 && avgNum <= 3.5) {
                if (ratingTextEl) {
                    ratingTextEl.className = "badge average";
                    ratingTextEl.innerText = `متوسط (${avgRating})`;
                }
            } else {
                if (ratingTextEl) {
                    ratingTextEl.className = "badge excellent";
                    ratingTextEl.innerText = `ممتاز (${avgRating})`;
                }
            }
        }

        // حساب غياب الشهر الحالي ومنطق الإنذارات التكرارية الآلي
        const attendanceList = data.attendance || [];
        const currentMonth = new Date().getMonth() + 1; 
        
        const currentMonthAbsence = attendanceList.filter(item => item.month === currentMonth && item.status === "absent").length;
        document.getElementById('absentCount').innerText = `${currentMonthAbsence} أيام`;

        const warningBadge = document.getElementById('warningBadge');
        if(warningBadge) {
            if(currentMonthAbsence > 10) {
                const lastMonth = currentMonth - 1;
                const lastMonthAbsence = attendanceList.filter(item => item.month === lastMonth && item.status === "absent").length;
                
                if(lastMonthAbsence > 10) {
                    warningBadge.className = "badge weak";
                    warningBadge.style.display = "block";
                    warningBadge.innerText = "⚠️ إنذار بفصل 3 أيام (للمرة الـ 3)";
                } else {
                    warningBadge.className = "badge weak";
                    warningBadge.style.display = "block";
                    warningBadge.innerText = "⚠️ إنذار ثاني تكراري";
                }
            } else if (currentMonthAbsence > 5 && currentMonthAbsence <= 10) {
                warningBadge.className = "badge average";
                warningBadge.style.display = "block";
                warningBadge.innerText = "⚠️ إنذار أول بالغياب";
            } else {
                warningBadge.className = "badge excellent";
                warningBadge.style.display = "block";
                warningBadge.innerText = "✅ حالة الحضور مستقرة";
            }
        }

        // جلب وعرض المخالفات السلوكية بالتفصيل
        const violationsListEl = document.getElementById('violationsList');
        if(violationsListEl) {
            violationsListEl.innerHTML = "";
            if(!data.violations || data.violations.length === 0) {
                violationsListEl.innerHTML = "<span style='color:green;'>✅ لا توجد مخالفات مسجلة للطالب.</span>";
            } else {
                data.violations.forEach(v => {
                    violationsListEl.innerHTML += `<li><strong>${v.title}:</strong> ${v.details} <small style="color:#64748b;">(${v.date})</small></li>`;
                });
            }
        }

        // رصد درجات المواد والمجموع الكلي أوتوماتيكياً
        const gradesMap = data.grades || {};
        const gradesTableBody = document.getElementById('gradesTableBody');
        let totalSum = 0;
        
        if(gradesTableBody) {
            gradesTableBody.innerHTML = "";
            for(let subject in gradesMap) {
                totalSum += Number(gradesMap[subject] || 0);
                gradesTableBody.innerHTML += `
                    <tr>
                        <td>${subject}</td>
                        <td>${gradesMap[subject]} درجة</td>
                    </tr>
                `;
            }
            document.getElementById('totalGrades').innerText = `${totalSum} درجة`;
        }

        // إعادة رسم الـ Charts بالبيانات الجديدة المحدثة فوراً
        const totalSchoolDays = 30; 
        const presentDays = totalSchoolDays - currentMonthAbsence;
        renderAttendancePieChart(presentDays, currentMonthAbsence);
        renderGanttChart();

    }, (error) => {
        console.error("خطأ أثناء الاستماع لبيانات الطالب المعين:", error);
    });

    // 2. الاستماع اللحظي للوحة الشرف العالمية
    watchGlobalTop5();
}

// دالة تشغيل الـ Pie Chart
function renderAttendancePieChart(present, absent) {
    const ctx = document.getElementById('attendancePieChart')?.getContext('2d');
    if(!ctx) return;
    
    if(window.myPieChart) window.myPieChart.destroy();

    window.myPieChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: ['حضور', 'غياب'],
            datasets: [{
                data: [present, absent],
                backgroundColor: ['#22c55e', '#ef4444'],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom' } }
        }
    });
}

// دالة تشغيل الـ Gantt Chart
function renderGanttChart() {
    const ctx = document.getElementById('ganttChart')?.getContext('2d');
    if(!ctx) return;

    if(window.myGanttChart) window.myGanttChart.destroy();

    window.myGanttChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['أعمال السنة', 'امتحان العملي', 'الفاينال'],
            datasets: [
                {
                    label: 'بداية الفترة',
                    data: [1, 45, 75],
                    backgroundColor: 'rgba(0,0,0,0)', 
                    stack: 'Stack 0',
                },
                {
                    label: 'المدة الزمنية باليوم',
                    data: [45, 15, 15],
                    backgroundColor: ['#3b82f6', '#eab308', '#a855f7'],
                    stack: 'Stack 0',
                }
            ]
        },
        options: {
            indexAxis: 'y', 
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } }
        }
    });
}

// دالة جلب الـ Top 5
function watchGlobalTop5() {
    const top5ListEl = document.getElementById('top5List');
    if(!top5ListEl) return;

    const q = query(collection(db, "students"));
    
    onSnapshot(q, (querySnapshot) => {
        let studentList = [];

        querySnapshot.forEach(doc => {
            const d = doc.data();
            let sum = 0;
            for(let sub in d.grades) { 
                sum += Number(d.grades[sub] || 0); 
            }
            studentList.push({ name: d.name, total: sum });
        });

        studentList.sort((a, b) => b.total - a.total);
        const top5 = studentList.slice(0, 5);

        top5ListEl.innerHTML = "";
        top5.forEach((s, idx) => {
            let medal = "🏆";
            if(idx === 0) medal = "🥇";
            if(idx === 1) medal = "🥈";
            if(idx === 2) medal = "🥉";
            
            top5ListEl.innerHTML += `<li>${medal} المركز ${idx+1}: ${s.name} (${s.total} د)</li>`;
        });
    }, (error) => {
        console.error("خطأ في الاستماع للوحة الشرف العالمية:", error);
    });
}

// تفعيل الـ Listeners وربط زرار تسجيل الخروج
window.addEventListener('DOMContentLoaded', () => {
    watchParentDashboard();

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('currentStudentId'); 
            window.location.href = "login.html"; 
        });
    }
});