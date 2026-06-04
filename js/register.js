// js/register.js
import { auth, db } from "./firebase-config.js";
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

document.getElementById('registerBtn')?.addEventListener('click', async () => {
    const name = document.getElementById('parentName').value;
    const email = document.getElementById('parentEmail').value;
    const password = document.getElementById('parentPassword').value;
    const studentId = document.getElementById('studentIdInput').value;

    if(!name || !email || !password || !studentId) {
        return alert("برجاء ملء جميع الخانات المتاحة");
    }

    try {
        // 🔥 الخطوة الأهم: التحقق من أن كود الطالب موجود أصلًا في السيستم ومرفوع من الإدارة
        const studentDocRef = doc(db, "students", studentId);
        const studentSnap = await getDoc(studentDocRef);

        if(!studentSnap.exists()) {
            return alert("❌ خطأ: كود الطالب هذا غير مسجل في قاعدة بيانات المدرسة! راجع الإدارة.");
        }

        // لو الكود صح وموجود.. نكريت الحساب لولي الأمر
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // إنشاء مستند لولي الأمر في كولكشن users ونربطه بكود ابنه
        await setDoc(doc(db, "users", user.uid), {
            parentName: name,
            email: email,
            role: "parent",
            studentId: studentId // الربط السحري هنا 🔗
        });

        alert("🎉 تم إنشاء الحساب بنجاح وربطه ببيانات الطالب: " + studentSnap.data().name);
        window.location.href = "index.html"; // توجيهه لصفحة اللوجن

    } catch(error) {
        alert("خطأ في التسجيل: " + error.message);
    }
});