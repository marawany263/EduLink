// جزء من كود js/auth.js (تعديل وظيفة الـ Login ليدعم الجميع)
import { auth, db } from "./firebase-config.js";
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

document.getElementById('loginBtn')?.addEventListener('click', async () => {
    // استخدام .trim() لتفادي أي مسافات زائدة في الإيميل
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value.trim();

    if (!email || !password) {
        alert("⚠️ برجاء إدخال البريد الإلكتروني وكلمة المرور أولاً.");
        return;
    }

    try {
        // 1. تسجيل الدخول في الفايربيز Auth
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // 2. فحص سريع ومباشر للآدمن الرئيسي (بناءً على الإيميل)
        if (email === "admin@edulink.com") {
            alert("👋 أهلاً بك يا مدير النظام.. جاري التوجيه للوحة التحكم المركزي");
            window.location.href = "admin.html";
            return; // إنهاء الدالة فوراً
        }

        // 3. جلب مستند المستخدم من كولكشن "users" بالـ UID الخاص به
        const userDoc = await getDoc(doc(db, "users", user.uid));
        
        if (userDoc.exists()) {
            const userData = userDoc.data();
            
            // الفحص الأول: هل الحساب مخصص للمعلم؟
            if (userData.role === "teacher") {
                // تخزين كود/معرف المدرس في ذاكرة المتصفح
                localStorage.setItem('currentTeacherId', user.uid);
                
                alert(`👨‍🏫 أهلاً بك يا أستاذ/ة: ${userData.name || 'المعلم'}`);
                window.location.href = "teacher.html";
            } 
            // الفحص الثاني: هل هو ولي أمر؟ (كودك القديم سليم 100%)
            else {
                if (userData.studentId) {
                    // تخزين كود الطالب في ذاكرة المتصفح فوراً 💾
                    localStorage.setItem('currentStudentId', userData.studentId);
                    
                    alert("✨ أهلاً بولي الأمر.. جاري تحميل بيانات الطالب اللحظية");
                    window.location.href = "parent.html";
                } else {
                    alert("⚠️ هذا الحساب مسجل ولكن غير مرتبط بكود طالب، راجع إدارة المدرسة.");
                }
            }

        } else {
            alert("❌ الحساب مسجل في الـ Auth ولكن لا توجد له بيانات في الـ Firestore.");
        }

    } catch (error) {
        console.error("خطأ في تسجيل الدخول:", error);
        alert("❌ خطأ في تسجيل الدخول: " + error.message);
    }
});