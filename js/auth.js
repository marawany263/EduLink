// js/auth.js
import { auth, db } from "./firebase-config.js";
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ✨ دالة إظهار التوستر الاحترافي بديل الـ alert التقليدي
function showToast(message, type = "success") {
    const container = document.getElementById("toastContainer");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.innerText = message;

    container.appendChild(toast);

    // حذف التوستر بعد انتهاء الأنيميشن
    setTimeout(() => {
        toast.remove();
    }, 4000);
}

// 🌐 قاموس ترجمة أخطاء الفايربيز المخصصة لتسجيل الدخول
const firebaseLoginErrors = {
    "auth/invalid-credential": "❌ البريد الإلكتروني أو كلمة المرور غير صحيحة.",
    "auth/user-not-found": "❌ هذا الحساب غير مسجل بالنظام.",
    "auth/wrong-password": "❌ كلمة المرور التي أدخلتها خاطئة.",
    "auth/invalid-email": "⚠️ صيغة البريد الإلكتروني غير صحيحة.",
    "auth/too-many-requests": "🚫 تم حظر المحاولات مؤقتاً لكثرة الأخطاء، يرجى المحاولة لاحقاً.",
    "auth/network-request-failed": "🌐 فشل الاتصال بالشبكة، تحقق من الإنترنت لديك."
};

document.getElementById('loginBtn')?.addEventListener('click', async () => {
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value.trim();

    // التحقق من الحقول الفارغة
    if (!email || !password) {
        return showToast("⚠️ برجاء إدخال البريد الإلكتروني وكلمة المرور أولاً.", "error");
    }

    try {
        // 1. تسجيل الدخول في الفايربيز Auth
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // 2. جلب مستند المستخدم من كولكشن "users" بالـ UID الخاص به فوراً
        const userDoc = await getDoc(doc(db, "users", user.uid));
        
        if (userDoc.exists()) {
            const userData = userDoc.data();
            
            // 🛡️ الفحص الأول: هل الحساب هو مدير النظام (Admin)؟
            if (userData.role === "admin") {
                // تخزين الرتبة لحماية لوحة التحكم (Route Guard)
                localStorage.setItem('currentUserRole', 'admin');
                
                showToast("👋 أهلاً بك يا مدير النظام.. جاري التوجيه للوحة التحكم المركزي", "success");
                setTimeout(() => {
                    window.location.href = "admin.html";
                }, 2000);
            } 
            
            // 👨‍🏫 الفحص الثاني: هل الحساب مخصص للمعلم؟
            else if (userData.role === "teacher") {
                localStorage.setItem('currentTeacherId', user.uid);
                localStorage.setItem('currentUserRole', 'teacher');
                
                showToast(`👨‍🏫 أهلاً بك يا أستاذ/ة: ${userData.name || 'المعلم'}`, "success");
                setTimeout(() => {
                    window.location.href = "teacher.html";
                }, 2000);
            } 
            
            // 👪 الفحص الثالث: هل هو ولي أمر؟
            else if (userData.role === "parent" || userData.studentId) {
                localStorage.setItem('currentStudentId', userData.studentId);
                localStorage.setItem('currentUserRole', 'parent');
                
                showToast("✨ أهلاً بولي الأمر.. جاري تحميل بيانات الطالب اللحظية", "success");
                setTimeout(() => {
                    window.location.href = "parent.html";
                }, 2000);
            } 
            
            // في حال وجود رتبة غير معرفة
            else {
                showToast("⚠️ هذا الحساب مسجل ولكن صلاحياته غير مفعّلة، راجع الإدارة.", "error");
            }

        } else {
            // حساب موجود في الـ Auth ولكن ليس له مستند بيانات في Firestore
            showToast("❌ الحساب مسجل في الـ Auth ولكن لا توجد له بيانات في السيرفر (Firestore).", "error");
        }

    } catch (error) {
        console.error("خطأ في تسجيل الدخول:", error);
        
        // فحص كود الخطأ وعرض الترجمة العربية المريحة للمستخدم
        const errorCode = error.code;
        const arabicMessage = firebaseLoginErrors[errorCode] || `خطأ في تسجيل الدخول: ${error.message}`;
        
        showToast(arabicMessage, "error");
    }
});