// js/register.js
import { auth, db } from "./firebase-config.js";
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ✨ دالة إظهار التوستر الاحترافي بديل الـ alert التقليدي
function showToast(message, type = "success") {
    const container = document.getElementById("toastContainer");
    if (!container) return;

    // إنشاء عنصر التوستر
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.innerText = message;

    // إضافة التوستر داخل الحاوية
    container.appendChild(toast);

    // حذف التوستر تلقائياً من الـ DOM بعد انتهاء الأنيميشن (4 ثوانٍ)
    setTimeout(() => {
        toast.remove();
    }, 4000);
}

// 🌐 قاموس ترجمة أخطاء الفايربيز للغة العربية
const firebaseErrorsArabic = {
    "auth/email-already-in-use": "هذا البريد الإلكتروني مسجل بالفعل بالنظام!",
    "auth/invalid-email": "صيغة البريد الإلكتروني غير صحيحة.",
    "auth/weak-password": "كلمة المرور ضعيفة جداً، يجب ألا تقل عن 6 رموز.",
    "auth/network-request-failed": "فشل الاتصال بالشبكة، تحقق من الإنترنت لديك."
};

document.getElementById('registerBtn')?.addEventListener('click', async () => {
    const name = document.getElementById('parentName').value.trim();
    const email = document.getElementById('parentEmail').value.trim();
    const password = document.getElementById('parentPassword').value;
    const studentId = document.getElementById('studentIdInput').value.trim();

    // 1️⃣ التحقق من الحقول الفارغة
    if(!name || !email || !password || !studentId) {
        return showToast("⚠️ برجاء ملء جميع الخانات المتاحة لتسجيل الحساب", "error");
    }

    try {
        // 2️⃣ التحقق من أن كود الطالب موجود أصلًا في السيستم ومرفوع من الإدارة
        const studentDocRef = doc(db, "students", studentId);
        const studentSnap = await getDoc(studentDocRef);

        if(!studentSnap.exists()) {
            return showToast("❌ كود الطالب هذا غير مسجل بالمدرسة! راجع الإدارة.", "error");
        }

        // 3️⃣ إنشاء الحساب في Firebase Auth
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // 4️⃣ إنشاء مستند لولي الأمر في كولكشن users ونربطه بكود ابنه
        await setDoc(doc(db, "users", user.uid), {
            parentName: name,
            email: email,
            role: "parent",
            studentId: studentId // الربط السحري 🔗
        });

        // 5️⃣ إظهار رسالة النجاح الشيك
        showToast(`🎉 تم إنشاء الحساب بنجاح وربطه بالطالب: ${studentSnap.data().name}`, "success");

        // ⏳ تأخير التوجيه لثانيتين عشان يلحق يشوف التوستر الأخضر الجميل وهو بيظهر!
        setTimeout(() => {
            window.location.href = "login.html"; // التوجيه لصفحة تسجيل الدخول
        }, 2500);

    } catch(error) {
        console.error("Registration Error: ", error);
        
        // فحص كود الخطأ وعرض الترجمة العربية له، أو عرض الخطأ الأصلي لو مش في القاموس
        const errorCode = error.code;
        const arabicMessage = firebaseErrorsArabic[errorCode] || `خطأ في التسجيل: ${error.message}`;
        
        showToast(arabicMessage, "error");
    }
});