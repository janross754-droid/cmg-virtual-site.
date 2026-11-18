// CMG VIRTUAL browser configuration — use the Supabase project previously supplied for the live site.
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
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const packages = {
    "Starter Plan": { name: "Starter Plan", credits: 5, price: 10 },
    "Pro Plan": { name: "Pro Plan", credits: 15, price: 20 },
    "Elite Plan": { name: "Elite Plan", credits: 50, price: 30 }
  };

  document.addEventListener("DOMContentLoaded", async () => {
    if (!window.supabase || typeof window.supabase.createClient !== "function") {
      setMessage("authMsg", "The Supabase library did not load. Check your internet connection and refresh.", true);
      return;
    }

    const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
    let authMode = "signup";
    let currentUser = null;
    let selectedPackage = packages["Starter Plan"];
    let currentCredits = 0;

    $("year").textContent = new Date().getFullYear();

    // Theme preference — clean light theme is the default; users may switch to dark.
    try {
      const savedTheme = localStorage.getItem("cmg-theme");
      document.body.classList.toggle("light", savedTheme === "light");
    } catch (_) {
      document.body.classList.remove("light");
    }
    $("themeBtn").addEventListener("click", () => {
      document.body.classList.toggle("light");
      try { localStorage.setItem("cmg-theme", document.body.classList.contains("light") ? "light" : "dark"); } catch (_) {}
    });

    function setStep(step) {
      if (![1, 2, 3, 4].includes(step)) return;
      [1, 2, 3, 4].forEach((number) => {
        $("step" + number).classList.toggle("hidden", number !== step);
        $("step" + number).classList.toggle("active", number === step);
      });
      $("headerStep").textContent = `STEP ${step} OF 4`;
      $("stepTrackFill").style.width = `${((step - 1) / 3) * 100}%`;
      document.querySelectorAll("[data-step-dot]").forEach((dot) => {
        const number = Number(dot.dataset.stepDot);
        dot.classList.toggle("current", number === step);
        dot.classList.toggle("complete", number < step);
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
    }

    function setAuthMode(mode) {
      authMode = mode;
      const signup = mode === "signup";
      $("signupFields").classList.toggle("hidden", !signup);
      $("loginFields").classList.toggle("hidden", signup);
      $("authSubmit").textContent = signup ? "CREATE FREE ACCOUNT" : "LOG IN TO DASHBOARD";
      $("signupHeading").classList.toggle("hidden", !signup);
      $("authSwitchPrompt").textContent = signup ? "Already have an account?" : "New to CMG VIRTUAL?";
      $("authSwitchBtn").textContent = signup ? "Log In" : "Create Account";
      $("forgotBtn").classList.toggle("hidden", signup);
      document.querySelectorAll(".auth-tab").forEach((tab) => {
        const active = tab.dataset.mode === mode;
        tab.classList.toggle("active", active);
        tab.setAttribute("aria-selected", String(active));
      });
      setMessage("authMsg", "");
    }
    document.querySelectorAll(".auth-tab").forEach((button) => button.addEventListener("click", () => setAuthMode(button.dataset.mode)));
    $("authSwitchBtn").addEventListener("click", () => setAuthMode(authMode === "signup" ? "login" : "signup"));
    document.querySelectorAll("[data-toggle-password]").forEach((button) => {
      button.addEventListener("click", () => {
        const field = $(button.dataset.togglePassword);
        const showing = field.type === "text";
        field.type = showing ? "password" : "text";
        button.textContent = showing ? "Show" : "Hide";
      });
    });
    const countrySettings = {
      GH: { prefix: "+233", label: "🇬🇭 +233", digits: 9, flag: "🇬🇭" },
      NG: { prefix: "+234", label: "🇳🇬 +234", digits: 10, flag: "🇳🇬" }
    };
    function updatePhoneCountry() {
      const country = countrySettings[$("country").value] || countrySettings.GH;
      $("phonePrefix").textContent = country.label;
      $("phoneNumber").maxLength = country.digits;
      $("phoneNumber").placeholder = "Enter " + country.digits + " digits";
      const digits = $("phoneNumber").value.replace(/\\D/g, "").slice(0, country.digits);
      $("phoneNumber").value = digits;
      $("phonePreview").textContent = "Saved as " + country.prefix + digits;
    }
    $("country").addEventListener("change", updatePhoneCountry);
    $("phoneNumber").addEventListener("input", updatePhoneCountry);
    updatePhoneCountry();

    async function loadProfile() {
      const { data, error } = await db.from("profiles")
        .select("credits,role,full_name,phone_number")
        .eq("id", currentUser.id).maybeSingle();
      if (error || !data) {
        currentCredits = 0;
        $("creditCount").textContent = "0";
        $("packageBalance").textContent = "0";
        $("balanceStatus").textContent = "LOW BALANCE";
        $("balanceStatus").classList.add("low-balance");
        setMessage("profileMsg", error ? "Could not load your profile: " + error.message : "Your profile is not available yet. Please contact support.", true);
        return;
      }
      currentCredits = Number(data.credits || 0);
      $("creditCount").textContent = String(currentCredits);
      $("packageBalance").textContent = String(currentCredits);
      $("balanceStatus").textContent = currentCredits < 1 ? "LOW BALANCE" : "TOKENS AVAILABLE";
      $("balanceStatus").classList.toggle("low-balance", currentCredits < 1);
      const meta = currentUser.user_metadata || {};
      const name = data.full_name || meta.full_name || currentUser.email?.split("@")[0] || "there";
      $("userName").textContent = name.split(/\s+/)[0];
      setMessage("profileMsg", "Your token balance is up to date.");
      const adminMode = data.role === "admin";
      $("adminDashboard").classList.toggle("hidden", !adminMode);
      $("adminNavLink").classList.toggle("hidden", !adminMode);
      if (adminMode) setTimeout(() => $("loadAdmin").click(), 0);
    }

    async function saveProfileDetails() {
      if (!currentUser) return;
      const meta = currentUser.user_metadata || {};
      const fullName = meta.full_name || "";
      const phone = meta.phone_number || "";
      if (!fullName && !phone) return;
      const { error } = await db.from("profiles").update({ full_name: fullName, phone_number: phone }).eq("id", currentUser.id);
      if (error) console.warn("Profile details could not be updated yet:", error.message);
    }

    async function loadHistory() {
      const { data, error } = await db.from("predictions").select("id,analysis,created_at")
        .order("created_at", { ascending: false }).limit(8);
      if (error) {
        $("historyList").innerHTML = '<p class="muted">Analysis history is not available yet.</p>';
        return;
      }
      $("historyList").replaceChildren();
      if (!data?.length) {
        $("historyList").innerHTML = '<p class="muted">No analyses yet. Your completed reports will appear here.</p>';
        return;
      }
      data.forEach((item) => {
        const article = document.createElement("article");
        article.className = "history-item";
        const date = document.createElement("small");
        date.textContent = new Date(item.created_at).toLocaleString();
        const body = document.createElement("p");
        body.textContent = (item.analysis || "").slice(0, 700);
        article.append(date, body);
        $("historyList").append(article);
      });
    }

    async function refreshSession() {
      const { data, error } = await db.auth.getSession();
      if (error) setMessage("authMsg", error.message, true);
      currentUser = data?.session?.user || null;
      if (currentUser) {
        await saveProfileDetails();
        await loadProfile();
        await loadHistory();
        setStep(2);
      } else {
        currentCredits = 0;
        $("creditCount").textContent = "0";
        $("packageBalance").textContent = "0";
        $("balanceStatus").textContent = "LOW BALANCE";
        $("balanceStatus").classList.add("low-balance");
        $("adminDashboard").classList.add("hidden");
        $("adminNavLink").classList.add("hidden");
        setStep(1);
      }
      $("analyseBtn").disabled = !currentUser || !$("slipFile").files.length;
    }

    // Step 1: signup and login
    $("authForm").addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = $("authSubmit");
      button.disabled = true;
      setMessage("authMsg", authMode === "signup" ? "Creating your account…" : "Signing you in…");
      try {
        let result;
        if (authMode === "signup") {
          const fullName = $("fullName").value.trim();
          const email = $("email").value.trim();
          const countryCode = $("country").value;
          const country = countrySettings[countryCode] || countrySettings.GH;
          const phoneDigits = $("phoneNumber").value.replace(/\D/g, "");
          const password = $("password").value;
          const confirm = $("confirmPassword").value;
          if (fullName.length < 2) throw new Error("Please enter your full name.");
          if (!email) throw new Error("Please enter your email address.");
          if (phoneDigits.length !== country.digits || !/^\d+$/.test(phoneDigits)) throw new Error("Enter a valid " + (countryCode === "GH" ? "Ghana" : "Nigeria") + " phone number using " + country.digits + " digits after " + country.prefix + ".");
          if (password.length < 6) throw new Error("Your password must contain at least 6 characters.");
          if (password !== confirm) throw new Error("Your passwords do not match.");
          result = await db.auth.signUp({
            email,
            password,
            options: {
              emailRedirectTo: window.location.origin,
              data: { full_name: fullName, phone_number: country.prefix + phoneDigits, country: countryCode, referral_code: $("referralCode").value.trim() }
            }
          });
        } else {
          const email = $("loginEmail").value.trim();
          const password = $("loginPassword").value;
          if (!email || !password) throw new Error("Enter your email address and password.");
          result = await db.auth.signInWithPassword({ email, password });
        }
        if (result.error) throw result.error;
        if (authMode === "signup" && !result.data.session) {
          setMessage("authMsg", "Your account has been created. Please check your email to confirm it, then return here and log in.");
        } else {
          currentUser = result.data.user || result.data.session?.user || null;
          await refreshSession();
        }
      } catch (error) {
        setMessage("authMsg", error.message || "Authentication failed. Please try again.", true);
      } finally {
        button.disabled = false;
      }
    });

    $("forgotBtn").addEventListener("click", async () => {
      const email = $("loginEmail").value.trim();
      if (!email) { setMessage("authMsg", "Enter your email address first.", true); return; }
      setMessage("authMsg", "Sending password reset email…");
      const { error } = await db.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
      setMessage("authMsg", error ? error.message : "If the account exists, a password reset email has been sent.", Boolean(error));
    });

    async function logout() {
      const { error } = await db.auth.signOut();
      setMessage("authMsg", error ? error.message : "You have logged out.", Boolean(error));
      await refreshSession();
    }
    $("logoutBtn").addEventListener("click", logout);
    $("backToAccount").addEventListener("click", logout);

    // Step 2 -> Step 3
    $("buyTokensBtn").addEventListener("click", () => setStep(3));
    $("backToDashboard").addEventListener("click", () => setStep(2));
    $("backToPackages").addEventListener("click", () => setStep(3));

    document.querySelectorAll(".choose-package").forEach((button) => {
      button.addEventListener("click", () => {
        const pkg = packages[button.dataset.package];
        if (!pkg) return;
        selectedPackage = pkg;
        $("selectedPackageName").textContent = pkg.name;
        $("selectedPackageTokens").textContent = `${pkg.credits} tokens`;
        $("selectedPackagePrice").textContent = `GH₵${pkg.price}`;
        $("paymentAmountText").textContent = `Amount to send: GH₵${pkg.price}`;
        $("paymentForm").reset();
        $("proofPreview").classList.add("hidden");
        setMessage("paymentMsg", "");
        setStep(4);
      });
    });

    // Step 4: upload proof, then create a pending payment request. Tokens are never added here.
    $("paymentScreenshot").addEventListener("change", () => {
      const file = $("paymentScreenshot").files[0];
      const allowed = ["image/png", "image/jpeg", "image/webp"];
      if (!file) { $("proofPreview").classList.add("hidden"); return; }
      if (!allowed.includes(file.type) || file.size > 5 * 1024 * 1024) {
        $("paymentScreenshot").value = "";
        $("proofPreview").classList.add("hidden");
        setMessage("paymentMsg", "Choose a PNG, JPG or WEBP screenshot smaller than 5 MB.", true);
        return;
      }
      $("proofPreview").textContent = `Selected: ${file.name}`;
      $("proofPreview").classList.remove("hidden");
      setMessage("paymentMsg", "Payment screenshot ready to submit.");
    });

    $("paymentForm").addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!currentUser) { setMessage("paymentMsg", "Please log in before submitting a payment.", true); setStep(1); return; }
      const payerName = $("senderName").value.trim();
      const payerPhoneDigits = $("senderPhone").value.replace(/\D/g, "");
      const reference = $("txRef").value.trim() || null;
      const proof = $("paymentScreenshot").files[0];
      if (payerName.length < 2) { setMessage("paymentMsg", "Enter the sender's full name.", true); return; }
      if (!/^\d{9}$/.test(payerPhoneDigits)) { setMessage("paymentMsg", "Enter the sender's Ghana MoMo number using 9 digits after +233.", true); return; }
      if (!proof) { setMessage("paymentMsg", "Please upload your payment screenshot.", true); return; }
      if (proof.size > 5 * 1024 * 1024 || !["image/png", "image/jpeg", "image/webp"].includes(proof.type)) {
        setMessage("paymentMsg", "The screenshot must be PNG, JPG or WEBP and no larger than 5 MB.", true); return;
      }

      const button = $("submitPaymentBtn");
      button.disabled = true;
      button.textContent = "SUBMITTING PAYMENT…";
      setMessage("paymentMsg", "Uploading proof and submitting your request…");
      let uploadedPath = null;
      try {
        const { data: pkg, error: packageError } = await db.from("packages")
          .select("id,name,price,credits")
          .eq("name", selectedPackage.name).eq("active", true).single();
        if (packageError) throw new Error("The selected package is not configured yet. Please contact the administrator.");
        if (Number(pkg.price) !== selectedPackage.price || Number(pkg.credits) !== selectedPackage.credits) {
          throw new Error("The package price or token amount in the database does not match the displayed plan. Please contact the administrator.");
        }
        const extension = proof.type === "image/png" ? "png" : proof.type === "image/webp" ? "webp" : "jpg";
        const randomPart = window.crypto?.randomUUID ? window.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
        uploadedPath = `${currentUser.id}/${randomPart}.${extension}`;
        const { error: uploadError } = await db.storage.from("payment-proofs").upload(uploadedPath, proof, {
          cacheControl: "3600", upsert: false, contentType: proof.type
        });
        if (uploadError) throw uploadError;

        const { error: insertError } = await db.from("payments").insert({
          user_id: currentUser.id,
          package_id: pkg.id,
          amount: pkg.price,
          network: "MTN MoMo",
          transaction_reference: reference,
          payer_name: payerName,
          payer_phone: "+233" + payerPhoneDigits,
          screenshot_path: uploadedPath,
          status: "pending"
        });
        if (insertError) throw insertError;
        $("paymentForm").reset();
        $("proofPreview").classList.add("hidden");
        setMessage("paymentMsg", "Payment submitted successfully. Your request is waiting for admin approval. Tokens will be added only after verification.");
        await loadProfile();
        setTimeout(() => setStep(2), 1600);
      } catch (error) {
        if (uploadedPath) {
          try { await db.storage.from("payment-proofs").remove([uploadedPath]); } catch (_) {}
        }
        setMessage("paymentMsg", error.message || "Could not submit your payment. Please try again.", true);
      } finally {
        button.disabled = false;
        button.textContent = "SUBMIT PAYMENT FOR APPROVAL";
      }
    });

    // Service tiles lead to the same screenshot analysis tool with the selected service noted.
    document.querySelectorAll(".service-open").forEach((button) => {
      button.addEventListener("click", () => {
        const service = button.dataset.service || "game";
        $("analysisTitle").textContent = `Analyse ${service}`;
        $("analysisWorkspace").scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });

    // Screenshot analysis — existing Netlify function and one-token debit are preserved.
    $("slipFile").addEventListener("change", () => {
      const file = $("slipFile").files[0];
      const allowed = ["image/png", "image/jpeg", "image/webp"];
      if (file && (!allowed.includes(file.type) || file.size > 6 * 1024 * 1024)) {
        setMessage("analysisMsg", "Choose a PNG, JPG or WEBP image smaller than 6 MB.", true);
        $("slipFile").value = "";
      } else {
        setMessage("analysisMsg", file ? "Screenshot selected. Analysis uses 1 token." : "");
      }
      $("analyseBtn").disabled = !currentUser || !$("slipFile").files.length;
    });

    async function runLocalSlipScan(file) {
      if (!window.Tesseract) {
        await new Promise((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
          script.onload = resolve;
          script.onerror = () => reject(new Error("The free OCR scanner could not load. Check your internet connection and try again."));
          document.head.appendChild(script);
        });
      }
      if (!window.Tesseract || typeof window.Tesseract.recognize !== "function") {
        throw new Error("The free OCR scanner is unavailable in this browser.");
      }
      setMessage("analysisMsg", "FREE LOCAL SCAN: reading the slip image…");
      const result = await window.Tesseract.recognize(file, "eng", {
        logger: (progress) => {
          if (progress.status === "recognizing text" && Number.isFinite(progress.progress)) {
            setMessage("analysisMsg", "FREE LOCAL SCAN: reading image " + Math.round(progress.progress * 100) + "%…");
          }
        }
      });
      const text = String(result?.data?.text || "").trim();
      if (!text) throw new Error("No readable text was found. Try a sharper screenshot with the odds enlarged.");
      const odds = [...new Set((text.match(/\b(?:1\.0[1-9]|[1-9]\d?\.\d{2})\b/g) || [])
        .map(Number).filter((value) => value > 1 && value <= 100))].sort((a, b) => a - b);
      const lines = [
        "CMG VIRTUAL — FREE LOCAL OCR REPORT",
        "",
        "SCREENSHOT TEXT",
        text.slice(0, 2600),
        "",
        "ODDS SCAN"
      ];
      if (odds.length) {
        odds.slice(0, 20).forEach((odd, index) => {
          lines.push((index + 1) + ". " + odd.toFixed(2) + " odds — raw implied probability " + (100 / odd).toFixed(1) + "%");
        });
        lines.push("", "PRICE ORDER: the shortest visible decimal prices are listed first. This is a bookmaker-price comparison only.");
      } else {
        lines.push("No clear decimal odds were detected. Please upload a sharper image.");
      }
      lines.push("", "IMPORTANT: This free local scan reads visible text and sorts detected odds. It does not identify hidden virtual results or calculate a verified chance of winning. Check each extracted price against the original slip.");
      return lines.join("\n");
    }

    $("analyseBtn").addEventListener("click", async () => {
      const file = $("slipFile").files[0];
      if (!currentUser || !file) return;
      if (currentCredits < 1) {
        try {
          const localReport = await runLocalSlipScan(file);
          $("analysisResult").textContent = localReport;
          $("analysisResult").classList.remove("hidden");
          setMessage("analysisMsg", "Free local OCR scan completed. No token was used. Buy tokens to access the full AI analysis.");
        } catch (error) {
          setMessage("analysisMsg", error.message || "Local scan failed.", true);
        }
        return;
      }
      const button = $("analyseBtn");
      button.disabled = true;
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
        if (!response.ok && /AI provider account has run out of API credits|AI analysis is not configured/i.test(result.error || "")) {
          const localReport = await runLocalSlipScan(file);
          $("analysisResult").textContent = localReport;
          $("analysisResult").classList.remove("hidden");
          setMessage("analysisMsg", "Free local OCR scan completed. The full AI service needs its server API billing configured. No token was charged.");
          return;
        }
        if (!response.ok) throw new Error(result.error || "Analysis failed.");
        $("analysisResult").textContent = result.analysis;
        $("analysisResult").classList.remove("hidden");
        setMessage("analysisMsg", "Analysis complete. Your token balance has been updated.");
        await loadProfile();
        await loadHistory();
      } catch (error) {
        setMessage("analysisMsg", error.message || "Analysis failed. Please try again.", true);
      } finally {
        button.disabled = !currentUser || !$("slipFile").files.length;
      }
    });

    // Admin payment review queue
    $("loadAdmin").addEventListener("click", async () => {
      $("adminPayments").replaceChildren();
      setMessage("adminMsg", "Loading payment requests…");
      try {
        const { data } = await db.auth.getSession();
        if (!data.session) throw new Error("Please log in with your administrator account.");
        const response = await fetch("/.netlify/functions/admin-payments", {
          headers: { "Authorization": "Bearer " + data.session.access_token }
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Could not load payment requests.");
        const pendingCount = result.payments.filter((payment) => String(payment.status || "").toLowerCase() === "pending").length;
        result.payments.sort((left, right) => {
          const leftPending = String(left.status || "").toLowerCase() === "pending" ? 1 : 0;
          const rightPending = String(right.status || "").toLowerCase() === "pending" ? 1 : 0;
          return rightPending - leftPending || new Date(right.created_at || 0) - new Date(left.created_at || 0);
        });
        setMessage("adminMsg", `${pendingCount} pending approval(s) · ${result.payments.length} total request(s) found.`);
        if (!result.payments.length) {
          $("adminPayments").innerHTML = '<div class="empty-state">No payment requests yet. New customer submissions will appear here.</div>';
          return;
        }
        result.payments.forEach((payment) => {
          const card = document.createElement("article");
          card.className = "admin-payment-card";
          const head = document.createElement("div");
          head.className = "admin-payment-head";
          const customer = document.createElement("div");
          const name = document.createElement("strong");
          name.textContent = payment.payer_name || payment.profile_name || "Customer account";
          const email = document.createElement("small");
          email.textContent = payment.user_email || "Account details not supplied";
          customer.append(name, email);
          const status = document.createElement("span");
          const paymentStatus = String(payment.status || "unknown").toLowerCase();
          status.className = `status-pill ${paymentStatus === "pending" ? "pending" : paymentStatus === "approved" ? "approved" : "rejected"}`;
          status.textContent = paymentStatus;
          head.append(customer, status);
          const details = document.createElement("div");
          details.className = "admin-payment-details";
          const info = [
            ["Package", payment.package_name || "Package"],
            ["Amount", `GH₵${payment.amount}`],
            ["Tokens", `${payment.credits || 0}`],
            ["Sender number", payment.payer_phone || "Not supplied"],
            ["Transaction ID", payment.transaction_reference || "Not supplied"],
            ["Network", payment.network || "MTN MoMo"],
            ["Submitted", payment.created_at ? new Date(payment.created_at).toLocaleString() : ""]
          ];
          info.forEach(([label, value]) => {
            const item = document.createElement("div");
            const key = document.createElement("small"); key.textContent = label;
            const val = document.createElement("strong"); val.textContent = value;
            item.append(key, val); details.append(item);
          });
          card.append(head, details);
          if (payment.screenshot_url) {
            const proof = document.createElement("a");
            proof.className = "proof-link";
            proof.href = payment.screenshot_url;
            proof.target = "_blank";
            proof.rel = "noopener noreferrer";
            proof.textContent = "View payment screenshot ↗";
            card.append(proof);
          } else {
            const noProof = document.createElement("p");
            noProof.className = "muted";
            noProof.textContent = "No payment screenshot was attached to this request.";
            card.append(noProof);
          }
          if (paymentStatus === "pending") {
            const actions = document.createElement("div");
            actions.className = "admin-actions";
            const approve = document.createElement("button");
            approve.className = "btn primary";
            approve.textContent = `Approve & credit ${payment.credits || 0} tokens`;
            approve.addEventListener("click", () => reviewPayment(payment.id, "approve"));
            const reject = document.createElement("button");
            reject.className = "btn danger-btn";
            reject.textContent = "Reject request";
            reject.addEventListener("click", () => reviewPayment(payment.id, "reject"));
            actions.append(approve, reject); card.append(actions);
          }
          $("adminPayments").append(card);
        });
      } catch (error) {
        setMessage("adminMsg", error.message || "Could not load payment requests.", true);
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
        setMessage("adminMsg", action === "approve" ? "Payment approved. Tokens have been credited to the customer." : "Payment request rejected. No tokens were added.");
        $("loadAdmin").click();
      } catch (error) {
        setMessage("adminMsg", error.message || "Payment review failed.", true);
      }
    }

    db.auth.onAuthStateChange(() => { refreshSession(); });
    await refreshSession();
  });
})();
