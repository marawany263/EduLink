// js/parent.js
import { db } from "./firebase-config.js";
import { doc, onSnapshot, collection, query } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// قراءة كود الطالب الخاص بولي الأمر المسجل دخوله حالياً أوتوماتيكياً
const currentStudentId = localStorage.getItem('currentStudentId'); 

if (!currentStudentId) {
    alert("⚠️ غير مسموح بالدخول المباشر! برجاء تسجيل الدخول أولاً.");
    window.location.href = "index.html";
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
        let avgRating = 0;
        
        if(ratingKeys.length > 0) {
            let sum = 0;
            ratingKeys.forEach(key => sum += ratingsMap[key]);
            avgRating = (sum / ratingKeys.length).toFixed(1);
        }

        // عرض النجوم والنص حسب شروط الـ Capstone المحددة
        const ratingStarsEl = document.getElementById('ratingStars');
        const ratingTextEl = document.getElementById('ratingText');
        
        if(avgRating <= 2.5) {
            ratingStarsEl.innerText = "⭐";
            ratingTextEl.className = "badge weak";
            ratingTextEl.innerText = `ضعيف (${avgRating})`;
        } else if(avgRating >= 2.6 && avgRating <= 3.5) {
            ratingStarsEl.innerText = "⭐⭐⭐";
            ratingTextEl.className = "badge average";
            ratingTextEl.innerText = `متوسط (${avgRating})`;
        } else {
            ratingStarsEl.innerText = "⭐⭐⭐⭐⭐";
            ratingTextEl.className = "badge excellent";
            ratingTextEl.innerText = `ممتاز (${avgRating})`;
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

    // 2. الاستماع اللحظي للوحة الشرف العالمية (تتحدث لو درجات أي طالب تغيرت)
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

// دالة تشغيل الـ Gantt Chart الأفقي للترم
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

// دالة جلب الـ Top 5 على مستوى المدرسة كلها بشكل لحظي ومستمر
function watchGlobalTop5() {
    const top5ListEl = document.getElementById('top5List');
    if(!top5ListEl) return;

    const q = query(collection(db, "students"));
    
    // استخدام onSnapshot لمراقبة قائمة الطلاب كلها ولحساب الترتيب أوتوماتيكياً
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

        // ترتيب تنازلي
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

// تشغيل الـ Real-time Listeners فور اكتمال تحميل الـ HTML
window.addEventListener('DOMContentLoaded', watchParentDashboard);