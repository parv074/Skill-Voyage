// ===== APP STATE =====
    const state = {
      currentPage: null,
      pageCache: {},
      berryBalance: 2450,
      escrow: 420,
      activeIsland: localStorage.getItem('skillVoyageIsland') || 'Water 7',
      user: null,
    };

    // Public client settings are safe for browser use. Database access is protected by RLS in supabase-schema.sql.
    const supabaseClient = window.supabase.createClient(
      'https://pjiutsysjwgimzrxocrc.supabase.co',
      'sb_publishable_Kg0QifTgu0Xmf1Zap4FFuA_9-6Q7nVp'
    );
    // Dynamic page scripts access these shared values through window.
    window.state = state;
    window.supabaseClient = supabaseClient;

    async function refreshCurrentUser() {
      const { data: { user } } = await supabaseClient.auth.getUser();
      state.user = user || null;
      const accountName = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'Guest Captain';
      document.querySelectorAll('[data-captain-name]').forEach(el => el.textContent = `Captain ${accountName}`);
      if (user) await supabaseClient.from('profiles').upsert({ id:user.id, display_name:accountName }, { onConflict:'id' });
      return user;
    }
    async function signInWithEmail(email, password) {
      const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
      if (error) { showToast(error.message); return false; }
      await refreshCurrentUser(); closeAppModal(); showToast('Welcome back, Captain!'); return true;
    }
    async function signUpWithEmail(username, email, password) {
      if (!username || username.trim().length < 3) { showToast('Choose a username with at least 3 characters.'); return false; }
      if (!/^\S+@\S+\.\S+$/.test(email || '')) { showToast('Enter a valid email address.'); return false; }
      if (!password || password.length < 6) { showToast('Password must contain at least 6 characters.'); return false; }
      const { data, error } = await supabaseClient.auth.signUp({ email, password, options:{ data:{ username, full_name:username } } });
      if (error) { showToast(error.message); return false; }
      if (data.user) {
        const { error: profileError } = await supabaseClient.from('profiles').upsert({id:data.user.id, display_name:username.trim(), username:username.trim()}, {onConflict:'id'});
        if (profileError) console.warn('Profile will be created after confirmation:', profileError.message);
      }
      showToast(data.session ? 'Account created. Welcome aboard!' : 'Account created. Check your email to confirm it, then log in.');
      if (data.session) { await refreshCurrentUser(); closeAppModal(); }
      return true;
    }
    async function signOutAccount() { await supabaseClient.auth.signOut(); state.user=null; closeAppModal(); showToast('You have logged out. Use email and password to enter another account.'); }
    async function requireSignIn() { if (state.user) return state.user; showToast('Please log in before continuing.'); openLoginPanel(); return null; }

    const islandDetails = {
      'Water 7': { category: 'programming', label: 'Programming & Tech' },
      'Ohara': { category: 'math', label: 'Academic & Research' },
      'Weatheria': { category: 'programming', label: 'AI & Data Science' },
      'Dressrosa': { category: 'design', label: 'Design & UI/UX' },
      'Wano': { category: 'languages', label: 'Athletics & Craft' },
      'Whole Cake': { category: 'languages', label: 'Culinary Arts' },
    };

    // ===== SIDEBAR TOGGLE (MOBILE) =====
    function toggleSidebar(open) {
      const sidebar = document.getElementById('sidebar');
      const backdrop = document.getElementById('sidebar-backdrop');
      if (open) {
        sidebar.classList.add('open');
        backdrop.classList.add('open');
      } else {
        sidebar.classList.remove('open');
        backdrop.classList.remove('open');
      }
    }

    // ===== TOAST =====
    let toastTimer;
    function showToast(msg) {
      const toast = document.getElementById('toast');
      document.getElementById('toast-message').textContent = msg;
      toast.classList.add('show');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => toast.classList.remove('show'), 2500);
    }

    function getNotifications() { try { return JSON.parse(localStorage.getItem('skillVoyageNotifications') || '[]'); } catch { return []; } }
    function addNotification(message, type='info') { const all=getNotifications(); all.unshift({message,type,time:'Just now'}); localStorage.setItem('skillVoyageNotifications',JSON.stringify(all.slice(0,12))); }
    function toggleNotifications() {
      const panel=document.getElementById('notification-panel'); const entries=getNotifications();
      panel.innerHTML=`<div class="p-4 border-b border-outline-variant flex items-center justify-between"><strong class="font-headline-sm text-primary">VOYAGE LOG</strong><button class="text-outline hover:text-on-surface" onclick="document.getElementById('notification-panel').classList.remove('open')"><span class="material-symbols-outlined text-[18px]">close</span></button></div>${entries.length?entries.map(item=>`<div class="p-4 border-b border-outline-variant/50 flex gap-2"><span class="material-symbols-outlined text-primary">${item.type==='quest'?'assignment_turned_in':'event_available'}</span><div><p class="text-body-sm text-on-surface">${item.message}</p><span class="text-[10px] text-outline">${item.time}</span></div></div>`).join(''):'<p class="p-4 text-body-sm text-on-surface-variant">No booked skills or accepted quests yet.</p>'}`;
      panel.classList.toggle('open');
    }

    function selectIsland(name) {
      if (!islandDetails[name]) return;
      state.activeIsland=name; localStorage.setItem('skillVoyageIsland',name);
      document.querySelectorAll('[data-active-island]').forEach(el=>el.textContent=`${name} • ${islandDetails[name].label}`);
      showToast(`${name} is now your active island.`);
      if (state.currentPage) { const saved=state.currentPage; state.currentPage=null; loadPage(saved); }
    }

    function openInfoModal(title, description) {
      closeAppModal(); const modal=document.createElement('div'); modal.id='app-modal'; modal.className='app-modal-backdrop';
      modal.innerHTML=`<section class="app-modal" role="dialog" aria-modal="true" aria-label="${title}"><button class="app-modal-close material-symbols-outlined" onclick="closeAppModal()" aria-label="Close">close</button><span class="font-label-md text-label-md text-primary">VOYAGE INFORMATION</span><h2 class="font-headline-md mt-2">${title}</h2><p class="mt-4 text-body-md">${description}</p><button class="mt-5 w-full rounded-lg bg-primary py-3 font-title-sm text-on-primary" onclick="closeAppModal()">Close</button></section>`; modal.addEventListener('click',e=>{if(e.target===modal)closeAppModal()});document.body.append(modal);
    }

    function dismissWelcomeGuide() {
      document.getElementById('welcome-guide').classList.add('hidden-guide');
      localStorage.setItem('skillVoyageGuideDismissed', 'true');
    }
    function toggleWelcomeGuide() {
      document.getElementById('welcome-guide').classList.toggle('hidden-guide');
    }

    function closeAppModal() { document.getElementById('app-modal')?.remove(); }
    function openAccountPanel() {
      closeAppModal();
      const modal = document.createElement('div'); modal.id='app-modal'; modal.className='app-modal-backdrop';
      const accountName = state.user?.user_metadata?.full_name || state.user?.user_metadata?.name || state.user?.email?.split('@')[0] || 'Guest Captain';
      modal.innerHTML = `<section class="app-modal" role="dialog" aria-modal="true" aria-label="Account rank"><button class="app-modal-close material-symbols-outlined" onclick="closeAppModal()" aria-label="Close">close</button><span class="font-label-md text-label-md text-primary">YOUR VOYAGE RANK</span><h2 class="font-headline-lg text-headline-lg mt-1">CAPTAIN ${accountName}</h2><div class="mt-5 rounded-lg bg-[#f6e4b9]/70 p-4 border border-[#b87a31]"><div class="flex justify-between items-end gap-3"><div><p class="font-label-sm uppercase">Current rank</p><h3 class="font-headline-md">Crew Captain</h3></div><span class="font-title-md text-primary">2,450 ฿ earned</span></div><div class="rank-progress mt-3"><span></span></div><p class="mt-2 text-body-sm">Earn <strong>1,350 ฿ more</strong> to become a <strong>First Mate</strong> at 3,800 ฿.</p></div><div class="grid grid-cols-3 gap-2 mt-5 text-center text-body-sm"><div><strong>Deckhand</strong><br><span>0 ฿</span></div><div><strong>Crew Captain</strong><br><span>2,000 ฿</span></div><div><strong>First Mate</strong><br><span>3,800 ฿</span></div></div><p class="mt-5 text-body-sm">Complete sessions, teach a skill, or finish quests to earn Berries and rise through the crew.</p><div class="grid grid-cols-2 gap-2 mt-5"><button class="rounded-lg border border-[#a76c31] py-2 font-title-sm" onclick="showAboutSkillVoyage()">About Skill Voyage</button><button class="rounded-lg bg-secondary-container py-2 font-title-sm text-on-secondary-container" onclick="state.user ? signOutAccount() : openLoginPanel()">${state.user ? 'Log out' : 'Log in'}</button></div></section>`;
      modal.addEventListener('click', e=>{if(e.target===modal)closeAppModal()}); document.body.append(modal);
    }

    function showAboutSkillVoyage() {
      closeAppModal(); const modal=document.createElement('div'); modal.id='app-modal'; modal.className='app-modal-backdrop';
      modal.innerHTML=`<section class="app-modal" role="dialog" aria-modal="true" aria-label="About Skill Voyage"><button class="app-modal-close material-symbols-outlined" onclick="closeAppModal()" aria-label="Close">close</button><span class="font-label-md text-label-md text-primary">ABOUT SKILL VOYAGE</span><h2 class="font-headline-md mt-1">HOW THE CREW WORKS</h2><p class="mt-3 text-body-sm">Skill Voyage is a student-to-student learning exchange. Members share skills, request help, and use Berries as a clear session reward.</p><div class="mt-4 space-y-3 text-body-sm"><div><strong>1. Find a voyage</strong><br>Browse Marketplace to book a guide, or Quest Board to accept a learner’s request.</div><div><strong>2. Reserve safely</strong><br>When you book or accept, the session is marked and the Berries stay protected in escrow until completion.</div><div><strong>3. Learn, teach, and rank up</strong><br>Complete sessions and quests to earn Berries. Your account shows your current rank and how far you are from the next one.</div></div><button class="mt-5 w-full rounded-lg bg-primary py-3 font-title-sm text-on-primary" onclick="closeAppModal()">Start exploring</button></section>`;modal.addEventListener('click',e=>{if(e.target===modal)closeAppModal()});document.body.append(modal);
    }
    function openLoginPanel() {
      closeAppModal(); const modal=document.createElement('div');modal.id='app-modal';modal.className='app-modal-backdrop';
      modal.innerHTML=`<section class="app-modal" role="dialog" aria-modal="true" aria-label="Account login"><button class="app-modal-close material-symbols-outlined" onclick="closeAppModal()" aria-label="Close">close</button><span class="font-label-md text-label-md text-primary">ACCOUNT</span><h2 class="font-headline-md text-headline-md mt-1">JOIN OR RETURN TO A CREW</h2><div class="grid grid-cols-2 gap-2 mt-4"><button id="show-login" class="rounded-lg bg-primary py-2 font-title-sm text-on-primary">Log in</button><button id="show-signup" class="rounded-lg border border-[#a76c31] py-2 font-title-sm">Create account</button></div><form id="auth-form" class="mt-4 space-y-3"><div id="username-field" class="hidden"><label class="block text-body-sm font-bold">Captain username<input name="username" class="mt-1 w-full rounded-lg border border-[#b87a31] bg-[#fff1ce] p-2" placeholder="Unique crew name"/></label></div><label class="block text-body-sm font-bold">Email<input required name="email" type="email" class="mt-1 w-full rounded-lg border border-[#b87a31] bg-[#fff1ce] p-2" placeholder="captain@example.com"/></label><label class="block text-body-sm font-bold">Password<input required name="password" type="password" minlength="6" class="mt-1 w-full rounded-lg border border-[#b87a31] bg-[#fff1ce] p-2" placeholder="At least 6 characters"/></label><button id="auth-submit" class="w-full rounded-lg bg-primary py-3 font-title-sm text-on-primary">Log in</button></form></section>`;modal.addEventListener('click',e=>{if(e.target===modal)closeAppModal()});document.body.append(modal);let mode='login';const usernameField=modal.querySelector('#username-field');const submit=modal.querySelector('#auth-submit');modal.querySelector('#show-login').addEventListener('click',()=>{mode='login';usernameField.classList.add('hidden');submit.textContent='Log in';});modal.querySelector('#show-signup').addEventListener('click',()=>{mode='signup';usernameField.classList.remove('hidden');submit.textContent='Create account';});modal.querySelector('#auth-form').addEventListener('submit',async e=>{e.preventDefault();const form=new FormData(e.currentTarget);if(mode==='signup')await signUpWithEmail(form.get('username'),form.get('email'),form.get('password'));else await signInWithEmail(form.get('email'),form.get('password'));});return;
      modal.innerHTML=`<section class="app-modal" role="dialog" aria-modal="true" aria-label="Switch account"><button class="app-modal-close material-symbols-outlined" onclick="closeAppModal()" aria-label="Close">close</button><span class="font-label-md text-label-md text-primary">ACCOUNT</span><h2 class="font-headline-md mt-1">LOG IN TO ANOTHER CREW</h2><form id="switch-account-form" class="mt-5 space-y-3"><label class="block text-body-sm font-bold">Captain name<input required class="mt-1 w-full rounded-lg border border-[#b87a31] bg-[#fff1ce] p-2" placeholder="Enter your name"/></label><label class="block text-body-sm font-bold">University / crew<input required class="mt-1 w-full rounded-lg border border-[#b87a31] bg-[#fff1ce] p-2" placeholder="e.g. Chandigarh Univ"/></label><button class="w-full rounded-lg bg-primary py-3 font-title-sm text-on-primary">Log in</button></form></section>`;modal.addEventListener('click',e=>{if(e.target===modal)closeAppModal()});document.body.append(modal);modal.querySelector('form').addEventListener('submit',e=>{e.preventDefault();const inputs=e.currentTarget.querySelectorAll('input');document.querySelectorAll('#sidebar .font-title-sm').forEach(el=>{if(el.textContent.includes('Captain'))el.textContent=`Captain ${inputs[0].value}`});localStorage.setItem('skillVoyageCaptain',inputs[0].value);closeAppModal();showToast(`Welcome aboard, Captain ${inputs[0].value}!`);});
    }

    // Keep login and registration independent: switching modes clears the other form's values.
    document.addEventListener('click', (event) => {
      const button = event.target.closest('#show-login, #show-signup');
      if (!button) return;
      event.preventDefault(); event.stopImmediatePropagation();
      const modal = document.getElementById('app-modal');
      const form = modal?.querySelector('#auth-form');
      if (!modal || !form) return;
      const signingUp = button.id === 'show-signup';
      modal.dataset.authMode = signingUp ? 'signup' : 'login';
      form.reset();
      const username = form.querySelector('[name="username"]');
      username.closest('#username-field').classList.toggle('hidden', !signingUp);
      username.required = signingUp;
      form.querySelector('#auth-submit').textContent = signingUp ? 'Create account' : 'Log in';
    }, true);
    document.addEventListener('submit', async (event) => {
      const form = event.target.closest('#auth-form');
      if (!form) return;
      event.preventDefault(); event.stopImmediatePropagation();
      const modal = document.getElementById('app-modal');
      const values = new FormData(form);
      const submit = form.querySelector('#auth-submit');
      const originalText = submit.textContent;
      submit.disabled = true;
      submit.innerHTML = '<span class="material-symbols-outlined animate-spin text-[18px] align-middle">progress_activity</span> Please wait…';
      try {
        if (modal?.dataset.authMode === 'signup') await signUpWithEmail(values.get('username'), values.get('email'), values.get('password'));
        else await signInWithEmail(values.get('email'), values.get('password'));
      } finally {
        if (document.body.contains(submit)) { submit.disabled = false; submit.textContent = originalText; }
      }
    }, true);

    // ===== NAVIGATION =====
    function setActiveNav(pageName) {
      document.querySelectorAll('.nav-link').forEach(link => {
        const isActive = link.dataset.page === pageName;
        link.classList.toggle('active', isActive);
        link.classList.toggle('bg-primary-container', isActive);
        link.classList.toggle('text-on-primary-container', isActive);
        link.classList.toggle('text-on-surface-variant', !isActive);
        link.classList.toggle('hover:bg-surface-container-high', !isActive);
        link.classList.toggle('hover:text-on-surface', !isActive);
      });
    }

    // ===== CONTENT EXTRACTION =====
    function extractMainContent(html) {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const main = doc.querySelector('main');
      if (!main) return '<p class="text-on-surface-variant p-8">Content unavailable.</p>';

      // Get everything inside main, skip the outer wrapper div's pt-16 padding (we handle that)
      let content = main.innerHTML;
      return content;
    }

    // ===== SCRIPT EXECUTION =====
    function executeScripts(container) {
      const scripts = container.querySelectorAll('script');
      scripts.forEach(oldScript => {
        const newScript = document.createElement('script');
        if (oldScript.src) {
          newScript.src = oldScript.src;
        } else {
          newScript.textContent = oldScript.textContent;
        }
        oldScript.parentNode.replaceChild(newScript, oldScript);
      });
    }

    // ===== PAGE LOADER =====
    async function loadPage(pageName) {
      if (state.currentPage === pageName) return;

      const navLink = document.querySelector(`[data-page="${pageName}"]`);
      if (!navLink) return;

      const file = navLink.dataset.file;
      const content = document.getElementById('page-content');
      const skeleton = document.getElementById('page-skeleton');

      // Transition out
      content.classList.add('loading');

      // Update state
      state.currentPage = pageName;
      setActiveNav(pageName);
      toggleSidebar(false);

      // Update URL hash
      history.pushState(null, '', '#' + pageName);

      // Check cache
      if (state.pageCache[pageName]) {
        setTimeout(() => {
          content.innerHTML = state.pageCache[pageName];
          executeScripts(content);
          wireUpInteractions();
          content.classList.remove('loading');
        }, 100);
        return;
      }

      // Show skeleton
      skeleton.classList.remove('hidden');

      try {
        const response = await fetch(file);
        if (!response.ok) throw new Error(`Failed to load ${file}`);
        const html = await response.text();
        const mainContent = extractMainContent(html);

        // Cache it
        state.pageCache[pageName] = mainContent;

        // Inject
        content.innerHTML = mainContent;
        executeScripts(content);
        wireUpInteractions();
      } catch (err) {
        content.innerHTML = `
          <div class="flex flex-col items-center justify-center py-space-xl gap-space-md text-center">
            <span class="material-symbols-outlined text-secondary text-[48px]">cloud_off</span>
            <h2 class="font-headline-md text-headline-md text-on-surface">Failed to Load Page</h2>
            <p class="font-body-md text-body-md text-on-surface-variant max-w-md">${err.message}. Make sure you're running a local server (e.g. <code class="text-primary">npx serve .</code>).</p>
            <button onclick="state.currentPage=null; loadPage('${pageName}')" class="px-space-lg py-space-sm rounded-lg bg-primary-container text-on-primary-container font-title-sm text-title-sm mt-space-md">
              Retry
            </button>
          </div>`;
      } finally {
        skeleton.classList.add('hidden');
        setTimeout(() => content.classList.remove('loading'), 50);
      }
    }

    // ===== WIRE UP PAGE INTERACTIONS =====
    function wireUpInteractions() {
      // Give reusable dashboard cards a subtle aged material instead of flat fills.
      document.querySelectorAll('#page-content .bg-surface-container-high.rounded-xl, #page-content .bg-surface-container-low.rounded-xl').forEach(card => {
        if (!card.closest('.quest-board')) card.classList.add('texture-card');
      });
      // Make internal nav links work (links with data-path in page content)
      document.querySelectorAll('#page-content [data-path]').forEach(link => {
        link.addEventListener('click', (e) => {
          e.preventDefault();
          const path = link.dataset.path;
          // Map data-path values to our page names
          const pathMap = {
            'your-ship': 'your-ship',
            'explore-islands': 'explore-islands',
            'skill-marketplace': 'marketplace',
            'marketplace': 'marketplace',
            'quest-board': 'quest-board',
            'berry-treasury': 'berry-treasury',
          };
          const pageName = pathMap[path];
          if (pageName) loadPage(pageName);
          else showToast(`"${path}" page coming soon, Captain!`);
        });
      });
      document.querySelectorAll('#page-content [data-island]').forEach(island => {
        island.setAttribute('role','button'); island.tabIndex=0;
        island.classList.toggle('ring-2', island.dataset.island===state.activeIsland);
        island.classList.toggle('ring-primary', island.dataset.island===state.activeIsland);
        island.addEventListener('click',()=>selectIsland(island.dataset.island));
        island.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();selectIsland(island.dataset.island)}});
      });
      const islandCopy = {
        'Water 7':'THE SHIPWRIGHT HAVEN', Ohara:'THE ARCHIVES OF DISCOVERY', Weatheria:'THE CLOUD NAVIGATION ACADEMY', Dressrosa:'THE DESIGN & MEDIA QUARTER', Wano:'THE STRATEGY DOJO', 'Whole Cake':'THE CULINARY WORKSHOP'
      };
      const islandHeading=[...document.querySelectorAll('#page-content h3')].find(el=>el.textContent.includes('THE SHIPWRIGHT HAVEN'));
      if (islandHeading) {
        islandHeading.textContent=`${state.activeIsland.toUpperCase()} • ${islandCopy[state.activeIsland]}`;
        const dockStatus=[...document.querySelectorAll('#page-content span')].find(el=>el.textContent.includes('Going Merry docked'));
        if(dockStatus) dockStatus.textContent=`Going Merry docked at ${state.activeIsland}`;
        const disciplineSets = {
          'Water 7': [['Advanced JavaScript: Async & WebGL','Modern frontend systems, visual rendering, and reliable async workflows.'],['Data Structures & Algorithms','Trees, graph traversal, and interview-ready problem solving.'],['C++20 System Programming & POSIX','Memory, concurrency, and high-performance systems engineering.']],
          Ohara: [['Research Methods & Academic Writing','Evidence-led research, citations, and clear academic argumentation.'],['Calculus & Linear Algebra','Core mathematics for science, data, and engineering.'],['Scientific Data Interpretation','Understand experiments, results, and research communication.']],
          Weatheria: [['Python for AI & LLM Pipelines','Build applied machine-learning and retrieval workflows.'],['Cloud Fundamentals','Deploy reliable applications with cloud-native practices.'],['Data Visualization','Turn datasets into clear, decision-ready stories.']],
          Dressrosa: [['Figma Design Systems & Tokens','Create reusable interfaces and handoff-ready components.'],['UI/UX Research Basics','Plan research and turn findings into better products.'],['Visual Brand Storytelling','Build consistent, compelling creative direction.']],
          Wano: [['Strategic Problem Solving','Structured reasoning for complex challenges.'],['Fitness & Performance Planning','Build sustainable training and recovery plans.'],['Logic & Competitive Thinking','Sharpen decision-making under pressure.']],
          'Whole Cake': [['Culinary Foundations','Master kitchen skills, food safety, and balanced flavour.'],['Nutrition for Students','Practical eating plans for busy academic lives.'],['Food Presentation & Photography','Create polished plates and shareable visuals.']]
        };
        const options=disciplineSets[state.activeIsland]||disciplineSets['Water 7'];
        [...document.querySelectorAll('#page-content h4')].slice(0,3).forEach((heading,index)=>{if(options[index]){heading.textContent=options[index][0];const summary=heading.parentElement?.querySelector('p');if(summary)summary.textContent=options[index][1];}});
      }
      document.querySelectorAll('#page-content button').forEach(button => {
        const label=button.textContent.trim();
        if (label.includes('Inspect')) button.onclick=()=>{const card=button.closest('.group, article, div[class*="rounded-xl"]');openInfoModal(card?.querySelector('h3,h4')?.textContent.trim()||'Module details',card?.querySelector('p')?.textContent.trim()||'Module information and learning objectives are ready for review.');};
        if (label.includes('View Session Details')) button.onclick=()=>openInfoModal('Upcoming voyage: Advanced JavaScript Patterns','Your charter with Maya Chen is confirmed for tomorrow at 4:00 PM. Duration: 60 minutes. Your 420 ฿ escrow is secured and the voyage-room link opens 10 minutes before departure.');
      });

      // Make all buttons with no handler show a toast
      document.querySelectorAll('#page-content button:not([onclick])').forEach(btn => {
        if (!btn.hasAttribute('data-wired')) {
          btn.setAttribute('data-wired', 'true');
          btn.addEventListener('click', (e) => {
            // Don't override filter/modal buttons that already have listeners
            if (btn.closest('#ledger-filter-container') || btn.id || btn.dataset.marketFilter || btn.textContent.includes('Inspect') || btn.textContent.includes('View Session Details')) return;
            const text = btn.textContent.trim().substring(0, 30);
            showToast(`${text || 'Action'} — coming soon!`);
          });
        }
      });

      // Scroll to top on page load
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // ===== NAV CLICK HANDLERS =====
    document.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        loadPage(link.dataset.page);
      });
    });

    // ===== HASH ROUTING =====
    function handleHash() {
      const hash = location.hash.replace('#', '') || 'your-ship';
      const validPages = ['your-ship', 'explore-islands', 'marketplace', 'quest-board', 'berry-treasury'];
      loadPage(validPages.includes(hash) ? hash : 'your-ship');
    }

    window.addEventListener('popstate', handleHash);

    // ===== KEYBOARD SHORTCUTS =====
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') toggleSidebar(false);
      // Ctrl+1-5 for quick nav
      if (e.ctrlKey && e.key >= '1' && e.key <= '5') {
        e.preventDefault();
        const pages = ['your-ship', 'explore-islands', 'marketplace', 'quest-board', 'berry-treasury'];
        loadPage(pages[parseInt(e.key) - 1]);
      }
    });

    // ===== INIT =====
    if (localStorage.getItem('skillVoyageGuideDismissed') === 'true') {
      document.getElementById('welcome-guide').classList.add('hidden-guide');
    }
    refreshCurrentUser();
    supabaseClient.auth.onAuthStateChange(async () => { await refreshCurrentUser(); if (state.currentPage) { const page=state.currentPage; state.currentPage=null; loadPage(page); } });
    handleHash();
