// js/admin.js
import { db, firebaseConfig } from "./firebase-config.js"; // استيراد الـ db والـ config لتشغيل الحيلة الذكية
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, setDoc, updateDoc, arrayUnion, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ==========================================
// 1. إضافة طالب جديد وتأسيس بياناته
// ==========================================
document.getElementById('addStudentBtn')?.addEventListener('click', async () => {
    const idInput = document.getElementById('stuId');
    const nameInput = document.getElementById('stuName');
    const classInput = document.getElementById('stuClass');

    if(!idInput.value || !nameInput.value) return alert("برجاء إدخال البيانات كاملة");

    try {
        console.log("جاري محاولة إرسال البيانات للفايرستور...");
        
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
        
        // 👇 تنظيف الخانات فوراً بعد النجاح
        idInput.value = "";
        nameInput.value = "";
        
    } catch (error) {
        console.error("خطأ الفايربيز بالكامل:", error);
        alert("❌ الفايربيز رفض الحفظ! السبب غالباً صلاحيات الحماية المقفولة. نص الخطأ: " + error.message);
    }
});

// ==========================================
// 2. إضافة معلم جديد وتكريت حسابه (تعديل الـ Email & Password)
// ==========================================
const addTeacherForm = document.getElementById('addTeacherForm');

if (addTeacherForm) {
    addTeacherForm.addEventListener('submit', async (e) => {
        e.preventDefault(); // منع الصفحة من الريفرش عند الإرسال

        // جلب القيم من الفورم المعدلة
        const tName = document.getElementById('teacherName').value.trim();
        const tEmail = document.getElementById('teacherEmail').value.trim();
        const tPassword = document.getElementById('teacherPassword').value.trim();
        const tSubject = document.getElementById('teacherSubject').value.trim();
        const tClass = document.getElementById('teacherClass').value.trim();

        try {
            // 🔥 الحيلة الذكية: إنشاء نسخة مؤقتة من الفايربيز لحماية جلسة الآدمن من الخروج تلقائياً
            const secondaryApp = initializeApp(firebaseConfig, "SecondaryApp");
            const secondaryAuth = getAuth(secondaryApp);

            // أ. إنشاء حساب المدرس في Firebase Auth
            const userCredential = await createUserWithEmailAndPassword(secondaryAuth, tEmail, tPassword);
            const teacherUser = userCredential.user;

            // ب. حفظ بيانات المدرس في كولكشن "users" الموحد وبـ الـ UID الخاص به ليتوافق مع اللوجن
            await setDoc(doc(db, "users", teacherUser.uid), {
                name: tName,
                email: tEmail,
                subject: tSubject,
                class: tClass,
                role: "teacher" // رتبة الحساب للأمان وللتوجيه التلقائي
            });

            // جـ. تسجيل خروج وإغلاق النسخة المؤقتة فوراً بعد النجاح لضمان بقاء الآدمن متصلاً
            await secondaryAuth.signOut();

            alert(`✅ تم تسجيل المعلم (${tName}) وتكريت حسابه بنجاح! \nيمكنه الآن الدخول بإيميله الشخصي.`);
            addTeacherForm.reset(); // تفريغ الخانات بعد الحفظ

        } catch (error) {
            console.error("خطأ أثناء إضافة المعلم:", error);
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

    if(!idInput.value || !gradeInput.value) return alert("برجاء تحديد كود الطالب والدرجة");

    try {
        const gradeVal = parseFloat(gradeInput.value);
        const updateData = {};
        updateData[`grades.${subInput.value}`] = gradeVal;
        
        await updateDoc(doc(db, "students", idInput.value), updateData);
        alert("تم رصد الدرجة بنجاح!");
        
        // 👇 تنظيف خانة الدرجة فقط (ونترك كود الطالب لو هترصد له مادة تانية وراها)
        gradeInput.value = "";
        
    } catch(e) { alert("خطأ: " + e.message); }
});

// ==========================================
// 4. تسجيل مخالفة سلوكية
// ==========================================
document.getElementById('saveViolationBtn')?.addEventListener('click', async () => {
    const idInput = document.getElementById('targetStuId');
    const titleInput = document.getElementById('vTitle');
    const detailsInput = document.getElementById('vDetails');

    if(!idInput.value || !titleInput.value) return alert("برجاء إدخال كود الطالب وعنوان المخالفة");

    try {
        await updateDoc(doc(db, "students", idInput.value), {
            violations: arrayUnion({ 
                title: titleInput.value, 
                details: detailsInput.value, 
                date: new Date().toLocaleDateString() 
            })
        });
        alert("تم تسجيل المخالفة بنجاح!");
        
        // 👇 تنظيف خانات المخالفة بعد الرفع
        titleInput.value = "";
        detailsInput.value = "";
        idInput.value = ""; // مسح كود الطالب هنا بالمرة
        
    } catch(e) { alert("خطأ: " + e.message); }
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
    } catch(e) { alert("خطأ في جلب الدفعة: " + e.message); }
});