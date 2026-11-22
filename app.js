(() => {
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);
  const els = {
    login: $('#login'), loginForm: $('#login-form'), loginError: $('#login-error'), home: $('#home'), quiz: $('#quiz'), results: $('#results'), error: $('#error'),
    file: $('#json-file'), bankCount: $('#bank-count'), modeCards: $('#mode-cards'), loadArea: $('#load-area'),
    fullMode: $('#full-mode'), examMode: $('#exam-mode'), instantMode: $('#instant-mode'), dialog: $('#confirm-dialog'),
    dialogTitle: $('#dialog-title'), dialogMessage: $('#dialog-message'),
  };
  let bank = [], topicById = new Map(), session = null, reviewFilter = false;
  const accounts = { NguyenVanKhanh: '25120357', NgoAnhNguyen: '25120112', HuynhTanDuc: '25120478' };
  const AUTH_KEY = 'networkQuizUser';
  let currentUser = null;
  let soundEnabled = localStorage.getItem('networkQuizSound') !== 'off';

  function normalizeBank(data) {
    if (!data || !Array.isArray(data.topics)) throw new Error('Không tìm thấy danh sách “topics” trong JSON. Hãy chọn tệp ngân hàng câu hỏi đúng định dạng.');
    const flattened = [];
    const seen = new Set();
    data.topics.forEach((topic, topicIndex) => {
      if (!topic || !Array.isArray(topic.questions)) throw new Error(`Chủ đề thứ ${topicIndex + 1} không có danh sách “questions” hợp lệ.`);
      const topicId = topic.topic_id ?? topicIndex + 1;
      topic.questions.forEach((q, questionIndex) => {
        const id = `${topicId}-${q?.id ?? questionIndex + 1}`;
        if (!q || typeof q.question !== 'string' || !q.question.trim()) throw new Error(`Câu hỏi ${questionIndex + 1} trong chủ đề ${topicIndex + 1} thiếu nội dung.`);
        if (!q.options || typeof q.options !== 'object') throw new Error(`Câu hỏi “${q.question.slice(0, 50)}…” thiếu danh sách đáp án.`);
        const options = Array.isArray(q.options)
          ? q.options.map((value, i) => {
              if (typeof value !== 'string') return ['', ''];
              const match = value.match(/^\s*([A-Z])\s*[.)\-:]\s*(.*)$/s);
              return match ? [match[1], match[2]] : [String.fromCharCode(65 + i), value];
            }).filter(([key, value]) => key && value)
          : Object.entries(q.options).filter(([key, value]) => key && typeof value === 'string');
        if (options.length < 2) throw new Error(`Câu hỏi “${q.question.slice(0, 50)}…” cần có ít nhất 2 lựa chọn.`);
        if (!options.some(([key]) => key === q.answer)) throw new Error(`Đáp án đúng “${q.answer ?? ''}” không khớp với các lựa chọn ở câu hỏi “${q.question.slice(0, 50)}…”.`);
        if (seen.has(id)) throw new Error(`ID câu hỏi bị trùng: ${id}.`);
        seen.add(id);
        flattened.push({ ...q, options, explanation: typeof q.explanation === 'string' ? q.explanation : '', key: id, topicId, topicTitle: topic.topic_title || `Chủ đề ${topicId}` });
      });
    });
    if (!flattened.length) throw new Error('Tệp JSON không có câu hỏi nào.');
    return flattened;
  }

  function showError(message) { els.error.textContent = message; els.error.hidden = false; }
  function loadData(data) {
    try {
      bank = normalizeBank(data);
      topicById = new Map((data.topics || []).map(topic => [topic.topic_id, topic.topic_title]));
      els.error.hidden = true;
      els.bankCount.textContent = `Đã sẵn sàng · ${bank.length} câu hỏi`;
      $('#full-count').textContent = bank.length;
      $('#instant-count').textContent = bank.length;
      els.modeCards.hidden = false;
      els.loadArea.hidden = false;
      if (bank.length < 70) {
        els.examMode.disabled = true;
        els.examMode.title = 'Cần ít nhất 70 câu để tạo đề thi thử.';
        els.examMode.style.opacity = '.55';
      } else {
        els.examMode.disabled = false;
        els.examMode.title = '';
        els.examMode.style.opacity = '';
      }
    } catch (error) { bank = []; els.modeCards.hidden = true; els.bankCount.textContent = 'Không thể nạp ngân hàng câu hỏi'; showError(error.message); }
  }

  async function loadDefaultBank() {
    try {
      const response = await fetch('./questions.json');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      loadData(await response.json());
    } catch (error) {
      if (window.QUIZ_DATA) loadData(window.QUIZ_DATA);
      else {
        els.bankCount.textContent = 'Chưa nạp được ngân hàng câu hỏi';
        showError('Không thể tải questions.json. Hãy đặt tệp cạnh index.html hoặc chọn tệp JSON bằng nút bên dưới.');
      }
    }
  }

  function setSignedIn(username) {
    currentUser = username;
    els.login.hidden = true;
    els.home.hidden = false;
    $('#user-greeting').textContent = `Xin chào, ${username}`;
    $('#user-greeting').hidden = false;
    $('#logout').hidden = false;
  }
  function signOut() {
    localStorage.removeItem(AUTH_KEY);
    currentUser = null;
    els.login.hidden = false; els.home.hidden = true; els.quiz.hidden = true; els.results.hidden = true;
    $('#user-greeting').hidden = true; $('#logout').hidden = true;
    els.loginForm.reset(); els.loginError.hidden = true;
  }
  els.loginForm.addEventListener('submit', event => {
    event.preventDefault();
    const username = $('#username').value;
    const password = $('#password').value;
    if (Object.hasOwn(accounts, username) && accounts[username] === password) {
      localStorage.setItem(AUTH_KEY, username);
      els.loginError.hidden = true;
      setSignedIn(username);
    } else {
      els.loginError.textContent = 'Tên đăng nhập hoặc mật khẩu không chính xác. Vui lòng kiểm tra lại.';
      els.loginError.hidden = false;
    }
  });
  $('#guest-login').addEventListener('click', () => {
    localStorage.setItem(AUTH_KEY, 'guest');
    els.loginError.hidden = true;
    setSignedIn('Khách');
  });
  $('#logout').addEventListener('click', signOut);
  const rememberedUser = localStorage.getItem(AUTH_KEY);
  if (rememberedUser === 'guest' || (rememberedUser && Object.hasOwn(accounts, rememberedUser))) {
    setSignedIn(rememberedUser === 'guest' ? 'Khách' : rememberedUser);
  }
  function updateSoundButton() {
    const button = $('#sound-toggle');
    button.textContent = soundEnabled ? '♫ Âm thanh bật' : '♫ Âm thanh tắt';
    button.setAttribute('aria-pressed', String(soundEnabled));
    button.classList.toggle('muted', !soundEnabled);
  }
  function playCorrectSound() {
    if (!soundEnabled) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    try {
      const context = new AudioContextClass();
      [660, 880].forEach((frequency, index) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const start = context.currentTime + index * 0.13;
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(frequency, start);
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.12, start + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.085);
        oscillator.connect(gain); gain.connect(context.destination);
        oscillator.start(start); oscillator.stop(start + 0.09);
      });
      window.setTimeout(() => context.close(), 450);
    } catch (_) { /* Âm thanh không khả dụng trên một số trình duyệt hoặc thiết bị. */ }
  }
  $('#sound-toggle').addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    localStorage.setItem('networkQuizSound', soundEnabled ? 'on' : 'off');
    updateSoundButton();
  });
  updateSoundButton();

  els.file.addEventListener('change', async event => {
    const file = event.target.files?.[0]; if (!file) return;
    try { loadData(JSON.parse(await file.text())); }
    catch (error) { showError(error instanceof SyntaxError ? 'Tệp này không phải JSON hợp lệ. Hãy kiểm tra tệp rồi thử lại.' : `Không thể đọc tệp: ${error.message}`); }
    event.target.value = '';
  });

  function shuffle(array) {
    const out = array.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }
  function startQuiz(mode) {
    if (!bank.length) return;
    if (mode === 'exam' && bank.length < 70) { showError('Đề thi thử cần ít nhất 70 câu hỏi. Hãy nạp một ngân hàng lớn hơn.'); return; }
    const questions = mode === 'exam' ? shuffle(bank).slice(0, 70) : bank.slice();
    session = { mode, questions, answers: Array(questions.length).fill(null), index: 0, submitted: false };
    els.home.hidden = true; els.results.hidden = true; els.quiz.hidden = false;
    $('#quiz-kind').textContent = mode === 'exam' ? 'THI THỬ NGẪU NHIÊN' : mode === 'instant' ? 'LUYỆN TẬP · PHẢN HỒI NGAY' : 'ÔN TẬP TOÀN BỘ';
    $('#quiz-topic').textContent = mode === 'exam' ? 'Đề thi thử' : mode === 'instant' ? 'Luyện tập có giải thích' : 'Ngân hàng câu hỏi';
    $('#submit-top').innerHTML = mode === 'instant' ? 'Kết thúc <span>→</span>' : 'Nộp bài <span>→</span>';
    renderQuestion(); window.scrollTo(0, 0);
  }
  els.fullMode.addEventListener('click', () => startQuiz('full'));
  els.examMode.addEventListener('click', () => startQuiz('exam'));
  els.instantMode.addEventListener('click', () => startQuiz('instant'));

  function renderQuestion() {
    const { questions, answers, index, submitted } = session;
    const q = questions[index];
    const answered = answers.filter(value => value !== null).length;
    $('#question-position').textContent = `Câu ${index + 1}`;
    const correctSoFar = answers.reduce((sum, answer, i) => sum + (answer !== null && answer === questions[i].answer ? 1 : 0), 0);
    $('#answered-count').textContent = session.mode === 'instant'
      ? `Đúng ${correctSoFar} / Đã làm ${answered} trên ${questions.length}`
      : `Đã làm ${answered}/${questions.length} câu`;
    $('#progress-fill').style.width = `${answered / questions.length * 100}%`;
    $('#question-counter').textContent = `${String(index + 1).padStart(2, '0')} / ${questions.length}`;
    $('#question-jump-label').textContent = `${index + 1} trên ${questions.length}`;
    $('#topic-label').textContent = q.topicTitle;
    $('#question-text').textContent = q.question;
    const options = $('#options'); options.replaceChildren();
    q.options.forEach(([key, value]) => {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'option';
      const instantAnswered = session.mode === 'instant' && answers[index] !== null;
      if (answers[index] === key) button.classList.add('selected');
      if ((submitted || instantAnswered) && key === q.answer) button.classList.add('correct');
      if ((submitted || instantAnswered) && answers[index] === key && key !== q.answer) button.classList.add('wrong');
      button.disabled = submitted || instantAnswered;
      const mark = document.createElement('span'); mark.className = 'option-letter'; mark.textContent = key;
      const text = document.createElement('span'); text.textContent = value;
      button.append(mark, text);
      button.addEventListener('click', () => {
        if (!session.submitted && !(session.mode === 'instant' && session.answers[index] !== null)) {
          session.answers[index] = key;
          if (session.mode === 'instant' && key === q.answer) playCorrectSound();
          renderQuestion();
        }
      });
      options.append(button);
    });
    const explanation = $('#explanation');
    if (submitted || (session.mode === 'instant' && answers[index] !== null)) {
      explanation.hidden = false;
      const correct = document.createElement('b'); correct.textContent = `Đáp án đúng: ${q.answer}`;
      correct.textContent = `Giải thích · Đáp án đúng: ${q.answer}`;
      const detail = document.createElement('span'); detail.textContent = ` · ${q.explanation || 'Chưa có lời giải thích cho câu này'}`;
      explanation.replaceChildren(correct, detail);
    } else { explanation.hidden = true; explanation.replaceChildren(); }
    $('#prev-question').disabled = index === 0;
    $('#next-question').disabled = index === questions.length - 1;
    renderNavigator();
  }
  function renderNavigator() {
    const grid = $('#navigator-grid'); grid.replaceChildren();
    const { questions, answers, index, submitted } = session;
    questions.forEach((q, i) => {
      const button = document.createElement('button'); button.type = 'button'; button.textContent = i + 1;
      if (answers[i] !== null) button.classList.add('answered');
      if (i === index) button.classList.add('current');
      if (submitted || (session.mode === 'instant' && answers[i] !== null)) button.classList.add(answers[i] === q.answer ? 'review-right' : 'review-wrong');
      button.setAttribute('aria-label', `Câu ${i + 1}${answers[i] === null ? ', chưa làm' : ', đã chọn'}`);
      button.addEventListener('click', () => { session.index = i; renderQuestion(); }); grid.append(button);
    });
    const answered = answers.filter(value => value !== null).length;
    const correct = answers.reduce((sum, answer, i) => sum + (answer !== null && answer === questions[i].answer ? 1 : 0), 0);
    $('#navigator-summary').textContent = session.mode === 'instant'
      ? `${correct} đúng · ${answered} đã làm · ${questions.length - answered} còn lại`
      : `${answered} đã làm · ${questions.length - answered} còn lại`;
  }
  $('#prev-question').addEventListener('click', () => { if (session?.index > 0) { session.index--; renderQuestion(); } });
  $('#next-question').addEventListener('click', () => { if (session && session.index < session.questions.length - 1) { session.index++; renderQuestion(); } });
  $('#navigator-toggle').addEventListener('click', () => {
    const nav = $('.navigator'); nav.classList.toggle('collapsed');
    $('#navigator-toggle').textContent = nav.classList.contains('collapsed') ? '+' : '−';
  });
  $('#back-home').addEventListener('click', () => { els.quiz.hidden = true; els.results.hidden = true; els.home.hidden = false; window.scrollTo(0, 0); });
  $('#submit-top').addEventListener('click', openSubmitDialog);

  function openSubmitDialog() {
    if (!session || session.submitted) return;
    const remaining = session.answers.filter(value => value === null).length;
    els.dialogTitle.textContent = remaining ? 'Bạn còn câu chưa chọn' : 'Sẵn sàng nộp bài?';
    els.dialogMessage.textContent = remaining ? `Còn ${remaining} câu chưa có đáp án. Bạn vẫn có thể nộp bài và các câu này sẽ được tính là sai.` : 'Sau khi nộp, bạn sẽ thấy điểm số và có thể xem lại từng đáp án.';
    els.dialog.showModal();
  }
  els.dialog.addEventListener('close', () => { if (els.dialog.returnValue === 'submit') submitQuiz(); });
  function submitQuiz() {
    session.submitted = true;
    const correct = session.questions.reduce((sum, q, i) => sum + (session.answers[i] === q.answer ? 1 : 0), 0);
    renderQuestion(); renderResults(correct); els.quiz.hidden = true; els.results.hidden = false; window.scrollTo(0, 0);
  }

  function renderResults(correct) {
    reviewFilter = false;
    const total = session.questions.length, percent = Math.round(correct / total * 100);
    els.results.replaceChildren();
    const hero = document.createElement('section'); hero.className = 'result-hero';
    hero.innerHTML = `<span class="eyebrow">${session.mode === 'exam' ? 'KẾT QUẢ THI THỬ' : 'KẾT QUẢ ÔN TẬP'}</span><h1>Bạn đã hoàn thành!</h1><div class="score">${correct}/${total}</div><div class="score-sub">câu đúng · ${percent}%</div>`;
    const actions = document.createElement('div'); actions.className = 'result-actions';
    const retry = document.createElement('button'); retry.className = 'primary-action'; retry.textContent = session.mode === 'exam' ? 'Làm đề mới' : 'Ôn tập lại'; retry.addEventListener('click', () => startQuiz(session.mode));
    const home = document.createElement('button'); home.className = 'secondary-action'; home.textContent = 'Về màn hình chính'; home.addEventListener('click', () => { els.results.hidden = true; els.home.hidden = false; window.scrollTo(0, 0); });
    actions.append(retry, home);
    const head = document.createElement('div'); head.className = 'review-head';
    head.innerHTML = `<div><h2>Xem lại câu trả lời</h2><p>Đáp án đúng được đánh dấu xanh, câu trả lời sai được đánh dấu đỏ.</p></div>`;
    const filter = document.createElement('button'); filter.className = 'filter-button'; filter.textContent = 'Chỉ xem các câu làm sai';
    filter.setAttribute('aria-pressed', 'false'); filter.addEventListener('click', () => { reviewFilter = !reviewFilter; filter.classList.toggle('active', reviewFilter); filter.setAttribute('aria-pressed', String(reviewFilter)); renderReviewList(list); });
    head.append(filter);
    const list = document.createElement('div'); list.className = 'review-list';
    els.results.append(hero, actions, head, list);
    renderReviewList(list);
  }
  function renderReviewList(list) {
    list.replaceChildren();
    const entries = session.questions.map((question, index) => ({ question, index })).filter(({ question, index }) => !reviewFilter || session.answers[index] !== question.answer);
    if (!entries.length) { const empty = document.createElement('div'); empty.className = 'empty-review'; empty.textContent = 'Tuyệt vời! Bạn không có câu nào làm sai.'; list.append(empty); return; }
    entries.forEach(({ question: q, index }) => {
      const card = document.createElement('article'); card.className = 'review-question';
      const meta = document.createElement('div'); meta.className = 'question-meta';
      const topic = document.createElement('span'); topic.className = 'topic-pill'; topic.textContent = q.topicTitle;
      const number = document.createElement('span'); number.textContent = `Câu ${index + 1}`; number.style.cssText = 'font-size:10px;color:#999bab'; meta.append(topic, number);
      const title = document.createElement('h3'); title.textContent = q.question;
      const options = document.createElement('div'); options.className = 'options';
      q.options.forEach(([key, value]) => {
        const row = document.createElement('div'); row.className = 'option';
        if (key === q.answer) row.classList.add('correct');
        if (session.answers[index] === key && key !== q.answer) row.classList.add('wrong');
        const letter = document.createElement('span'); letter.className = 'option-letter'; letter.textContent = key;
        const text = document.createElement('span'); text.textContent = value; row.append(letter, text); options.append(row);
      });
      card.append(meta, title, options);
      if (session.answers[index] === null) { const note = document.createElement('div'); note.className = 'answer-note'; note.textContent = `Chưa chọn đáp án · Đáp án đúng: ${q.answer}`; card.append(note); }
      else if (session.answers[index] !== q.answer) { const note = document.createElement('div'); note.className = 'answer-note'; note.textContent = `Bạn đã chọn ${session.answers[index]} · Đáp án đúng: ${q.answer}`; card.append(note); }
      if (q.explanation) { const exp = document.createElement('div'); exp.className = 'explanation'; exp.textContent = q.explanation; card.append(exp); }
      list.append(card);
    });
  }
  loadDefaultBank();
})();
