// CMG VIRTUAL browser configuration
const SUPABASE_URL = "https://qusfqdtnfxbbubcekroc.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_8cXtkeNzls3yrLJkSFIo-g_EKJKRQbD";

(() => {
  const $ = (id) => document.getElementById(id);
  const setMessage = (id, text, isError = false) => {
    const el = $(id);
    if (!el) return;
    el.textContent = text || "";
    el.classList.toggle("error", Boolean(isError));
  };

  document.addEventListener("DOMContentLoaded", async () => {
    if (!window.supabase || typeof window.supabase.createClient !== "function") {
      setMessage("authMsg", "The Supabase library did not load. Check your internet connection and refresh.", true);
      return;
    }

    const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
    let authMode = "signup";
    let currentUser = null;

    $("year").textContent = new Date().getFullYear();

    $("themeBtn").addEventListener("click", () => {
      document.body.classList.toggle("light");
      try { localStorage.setItem("cmg-theme", document.body.classList.contains("light") ? "light" : "dark"); } catch (_) {}
    });
    try {
      if (localStorage.getItem("cmg-theme") === "light") document.body.classList.add("light");
    } catch (_) {}

    document.querySelectorAll(".tab").forEach((button) => {
      button.addEventListener("click", () => {
        authMode = button.dataset.mode;
        document.querySelectorAll(".tab").forEach((tab) => tab.classList.toggle("active", tab === button));
        $("authSubmit").textContent = authMode === "signup" ? "Create account" : "Log in";
        $("password").setAttribute("autocomplete", authMode === "signup" ? "new-password" : "current-password");
        setMessage("authMsg", "");
      });
    });

    async function loadProfile() {
      const { data, error } = await db.from("profiles").select("credits,role").eq("id", currentUser.id).maybeSingle();
      if (error || !data) {
        $("creditCount").textContent = "—";
        setMessage("profileMsg", error ? "Could not load your profile: " + error.message : "Your profile is not available yet.", true);
        return;
      }
      $("creditCount").textContent = String(data.credits);
      setMessage("profileMsg", "Credit balance updated.");
      const adminMode = data.role === "admin";
      $("adminDashboard").classList.toggle("hidden", !adminMode);
      $("adminNavLink").classList.toggle("hidden", !adminMode);
      $("adminDashboardBtn").classList.toggle("hidden", !adminMode);
      if (adminMode) {
        // Load the review queue automatically for administrators after sign-in.
        setTimeout(() => $("loadAdmin").click(), 0);
      }
    }

    async function loadHistory() {
      const { data, error } = await db.from("predictions").select("id,analysis,created_at").order("created_at", { ascending: false }).limit(8);
      if (error) {
        $("historyList").innerHTML = '<p class="muted">Analysis history is not available yet.</p>';
        return;
      }
      $("historyList").replaceChildren();
      if (!data || data.length === 0) {
        $("historyList").innerHTML = '<p class="muted">No analyses yet.</p>';
        return;
      }
      data.forEach((item) => {
        const article = document.createElement("article");
        article.className = "history-item";
        const date = document.createElement("small");
        date.textContent = new Date(item.created_at).toLocaleString();
        const body = document.createElement("p");
        body.textContent = (item.analysis || "").slice(0, 500);
        article.append(date, body);
        $("historyList").append(article);
      });
    }

    async function refreshSession() {
      const { data, error } = await db.auth.getSession();
      if (error) setMessage("authMsg", error.message, true);
      currentUser = data?.session?.user || null;
      $("userPanel").classList.toggle("hidden", !currentUser);
      $("signedOutInfo").classList.toggle("hidden", Boolean(currentUser));
      $("authForm").classList.toggle("hidden", Boolean(currentUser));
      if (currentUser) {
        $("userEmail").textContent = currentUser.email || "Signed in";
        await loadProfile();
        await loadHistory();
      } else {
        $("creditCount").textContent = "0";
        $("adminDashboard").classList.add("hidden");
        $("adminNavLink").classList.add("hidden");
        $("adminDashboardBtn").classList.add("hidden");
        $("historyList").innerHTML = '<p class="muted">Log in to see your analysis history.</p>';
      }
      $("analyseBtn").disabled = !currentUser || !$("slipFile").files.length;
    }

    $("authForm").addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = $("authSubmit");
      button.disabled = true;
      setMessage("authMsg", authMode === "signup" ? "Creating your account…" : "Signing you in…");
      try {
        const email = $("email").value.trim();
        const password = $("password").value;
        if (!email || password.length < 6) throw new Error("Enter a valid email and a password of at least 6 characters.");
        const result = authMode === "signup"
          ? await db.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } })
          : await db.auth.signInWithPassword({ email, password });
        if (result.error) throw result.error;
        if (authMode === "signup" && !result.data.session) {
          setMessage("authMsg", "Account created. Check your email for a confirmation link, then return and log in.");
        } else {
          setMessage("authMsg", authMode === "signup" ? "Account created successfully." : "Logged in successfully.");
          await refreshSession();
        }
      } catch (error) {
        setMessage("authMsg", error.message || "Authentication failed. Please try again.", true);
      } finally {
        button.disabled = false;
      }
    });

    $("forgotBtn").addEventListener("click", async () => {
      const email = $("email").value.trim();
      if (!email) { setMessage("authMsg", "Enter your email address first.", true); return; }
      setMessage("authMsg", "Sending password reset email…");
      const { error } = await db.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
      setMessage("authMsg", error ? error.message : "If the account exists, a password reset email has been sent.", Boolean(error));
    });

    $("logoutBtn").addEventListener("click", async () => {
      const { error } = await db.auth.signOut();
      setMessage("authMsg", error ? error.message : "You have logged out.", Boolean(error));
      await refreshSession();
    });

    $("buyStarter").addEventListener("click", () => $("paymentSection").scrollIntoView({ behavior: "smooth" }));
    $("adminDashboardBtn").addEventListener("click", () => $("adminDashboard").scrollIntoView({ behavior: "smooth" }));

    $("paymentForm").addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!currentUser) { setMessage("paymentMsg", "Please log in first.", true); return; }
      const reference = $("txRef").value.trim();
      if (!reference) { setMessage("paymentMsg", "Enter your transaction reference.", true); return; }
      setMessage("paymentMsg", "Submitting payment for admin verification…");
      try {
        const { data: pkg, error: packageError } = await db.from("packages").select("id,price").eq("name", "Starter Package").eq("active", true).single();
        if (packageError) throw packageError;
        const { error } = await db.from("payments").insert({
          user_id: currentUser.id, package_id: pkg.id, amount: pkg.price,
          network: $("network").value, transaction_reference: reference, status: "pending"
        });
        if (error) throw error;
        $("txRef").value = "";
        setMessage("paymentMsg", "Payment request submitted. Credits are added only after verification.");
      } catch (error) {
        setMessage("paymentMsg", error.code === "23505" ? "That transaction reference has already been used." : error.message, true);
      }
    });

    $("slipFile").addEventListener("change", () => {
      const file = $("slipFile").files[0];
      const allowed = ["image/png", "image/jpeg", "image/webp"];
      if (file && (!allowed.includes(file.type) || file.size > 6 * 1024 * 1024)) {
        setMessage("analysisMsg", "Choose a PNG, JPG or WEBP image smaller than 6 MB.", true);
        $("slipFile").value = "";
      } else {
        setMessage("analysisMsg", file ? "Screenshot selected. Sign in and use one credit to analyse." : "");
      }
      $("analyseBtn").disabled = !currentUser || !$("slipFile").files.length;
    });

    $("analyseBtn").addEventListener("click", async () => {
      const file = $("slipFile").files[0];
      if (!currentUser || !file) return;
      if (Number($("creditCount").textContent) < 1) {
        setMessage("analysisMsg", "You need an available credit. Submit a payment and wait for admin approval.", true);
        return;
      }
      $("analyseBtn").disabled = true;
      setMessage("analysisMsg", "Analysing screenshot. Please wait…");
      try {
        const { data: sessionData, error: sessionError } = await db.auth.getSession();
        if (sessionError || !sessionData.session) throw new Error("Your session expired. Please log in again.");
        const base64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result).split(",")[1]);
          reader.onerror = () => reject(new Error("Could not read the selected image."));
          reader.readAsDataURL(file);
        });
        const response = await fetch("/.netlify/functions/analyse-slip", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": "Bearer " + sessionData.session.access_token },
          body: JSON.stringify({ image: base64, mimeType: file.type })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Analysis failed.");
        $("analysisResult").textContent = result.analysis;
        $("analysisResult").classList.remove("hidden");
        setMessage("analysisMsg", "Analysis complete. Your credit balance has been updated.");
        await loadProfile();
        await loadHistory();
      } catch (error) {
        setMessage("analysisMsg", error.message || "Analysis failed. Please try again.", true);
      } finally {
        $("analyseBtn").disabled = !currentUser || !$("slipFile").files.length;
      }
    });

    $("loadAdmin").addEventListener("click", async () => {
      $("adminPayments").replaceChildren();
      setMessage("adminMsg", "Checking administrator access…");
      try {
        const { data } = await db.auth.getSession();
        if (!data.session) throw new Error("Please log in with your administrator account.");
        const response = await fetch("/.netlify/functions/admin-payments", {
          headers: { "Authorization": "Bearer " + data.session.access_token }
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Could not load payments.");
        setMessage("adminMsg", `Payment requests: ${result.payments.length}`);
        if (!result.payments.length) { $("adminPayments").textContent = "No payment requests yet. Customer submissions will appear here."; return; }
        result.payments.forEach((payment) => {
          const row = document.createElement("div");
          row.className = "payment-row";
          const title = document.createElement("b");
          title.textContent = payment.user_email || payment.user_id;
          const details = document.createElement("p");
          details.textContent = `GH₵${payment.amount} · ${payment.network} · ${payment.transaction_reference} · ${payment.status}`;
          row.append(title, details);
          if (payment.status === "pending") {
            const approve = document.createElement("button");
            approve.className = "btn primary small";
            approve.textContent = `Approve & credit ${payment.credits} tokens`;
            approve.addEventListener("click", () => reviewPayment(payment.id, "approve"));
            const reject = document.createElement("button");
            reject.className = "btn secondary small";
            reject.textContent = "Reject";
            reject.addEventListener("click", () => reviewPayment(payment.id, "reject"));
            row.append(approve, reject);
          }
          $("adminPayments").append(row);
        });
      } catch (error) {
        setMessage("adminMsg", error.message, true);
      }
    });

    async function reviewPayment(paymentId, action) {
      try {
        const { data } = await db.auth.getSession();
        if (!data.session) throw new Error("Please log in again.");
        const response = await fetch("/.netlify/functions/review-payment", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": "Bearer " + data.session.access_token },
          body: JSON.stringify({ paymentId, action })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Payment review failed.");
        setMessage("adminMsg", action === "approve" ? "Payment approved. Package tokens have been added to the customer account." : "Payment rejected.");
        $("loadAdmin").click();
      } catch (error) {
        setMessage("adminMsg", error.message, true);
      }
    }

    db.auth.onAuthStateChange(() => { refreshSession(); });
    await refreshSession();
  });
})();
