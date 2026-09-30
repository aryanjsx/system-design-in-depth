window.Quiz = (() => {
  const seenQuestions = new Set();
  
  function hasQuestions(slug) {
    return window.QUESTION_BANK && window.QUESTION_BANK[slug] && window.QUESTION_BANK[slug].length > 0;
  }
  
  // End-of-lesson questions: those not already placed inline after a section
  const endQuestions = slug => (window.QUESTION_BANK?.[slug] || []).filter(q => !q.section);

  function hasEndQuestions(slug) {
    return endQuestions(slug).length > 0;
  }

  function getNextQuestion(slug) {
    const questions = endQuestions(slug);
    const available = questions.filter(q => !seenQuestions.has(q.id));
    if (available.length === 0) {
      questions.forEach(q => seenQuestions.delete(q.id));
      return questions[Math.floor(Math.random() * questions.length)];
    }
    return available[Math.floor(Math.random() * available.length)];
  }

  function escapeHtml(str) {
    if (typeof str !== 'string') return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
  
  function renderQuiz(slug) {
    if (!hasQuestions(slug)) return '';
    
    if (!hasEndQuestions(slug)) return '';
    const q = getNextQuestion(slug);
    seenQuestions.add(q.id);
    
    return `
      <div class="exercise-box quiz-card" id="quiz-${q.id}" data-type="${q.type}" data-slug="${slug}">
        <div class="exercise-box__header">
          <div class="exercise-box__title">
            <span>Quiz: ${escapeHtml(q.title || 'Knowledge Check')}</span>
          </div>
          <span class="exercise-box__difficulty">${escapeHtml(q.difficulty || 'recall')}</span>
        </div>
        ${q.scenario ? `<div class="exercise-box__scenario"><strong>Scenario:</strong> ${escapeHtml(q.scenario)}</div>` : ''}
        <div class="exercise-box__prompt"><strong>Problem:</strong> ${escapeHtml(q.prompt)}</div>
        
        <div class="quiz-options exercise-options" id="quiz-options-${q.id}" style="margin-top: 15px;">
          ${renderOptions(q)}
        </div>

        <div class="quiz-actions" style="margin-top: 15px; display: flex; gap: 10px;">
           <button class="btn btn--primary quiz-submit-btn" data-qid="${q.id}">Submit</button>
           <button class="btn btn--secondary quiz-next-btn" data-slug="${slug}" style="display:none;">Try Another</button>
        </div>

        <div class="exercise-feedback quiz-feedback" id="feedback-${q.id}" style="display: none;">
          <div class="feedback-msg"></div>
          <div class="feedback-exp" style="margin-top:6px;"><strong>Explanation:</strong> ${escapeHtml(q.explanation)}</div>
        </div>
      </div>
    `;
  }

  function renderOptions(q) {
    let html = '';
    if (q.type === 'mcq') {
       q.options.forEach((opt, idx) => {
         html += `
           <label class="exercise-option quiz-option-label" style="display: flex; gap: 10px; cursor: pointer;">
             <input type="radio" name="quiz-${q.id}" value="${idx}" />
             <span>${escapeHtml(opt)}</span>
           </label>
         `;
       });
    } else if (q.type === 'multi') {
       q.options.forEach((opt, idx) => {
         html += `
           <label class="exercise-option quiz-option-label" style="display: flex; gap: 10px; cursor: pointer;">
             <input type="checkbox" name="quiz-${q.id}" value="${idx}" />
             <span>${escapeHtml(opt)}</span>
           </label>
         `;
       });
    } else if (q.type === 'ordering') {
       html += `<ul class="quiz-ordering-list" style="list-style: none; padding: 0;">`;
       q.options.forEach((opt, idx) => {
         html += `
           <li class="exercise-option quiz-order-item" data-id="${idx}" style="display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 5px;">
             <span>${escapeHtml(opt)}</span>
             <div>
               <button class="btn btn--sm quiz-up-btn" data-idx="${idx}">↑</button>
               <button class="btn btn--sm quiz-down-btn" data-idx="${idx}">↓</button>
             </div>
           </li>
         `;
       });
       html += `</ul>`;
    } else if (q.type === 'numeric') {
       html += `
         <input type="number" class="quiz-number-input" name="quiz-${q.id}" placeholder="Enter a number" style="padding: 8px; width: 100%; box-sizing: border-box;" />
       `;
    } else if (q.type === 'tradeoff') {
       html += `
         <div style="margin-bottom: 10px;">
           <strong>Select Option:</strong>
           ${q.options.map((opt, i) => `
             <label class="exercise-option quiz-option-label" style="display: flex; gap: 10px; cursor: pointer;">
               <input type="radio" name="quiz-tradeoff-opt-${q.id}" value="${i}" />
               <span>${escapeHtml(opt)}</span>
             </label>
           `).join('')}
         </div>
         <div>
           <strong>Select Reason:</strong>
           ${q.reasons.map((rsn, j) => `
             <label class="exercise-option quiz-option-label" style="display: flex; gap: 10px; cursor: pointer;">
               <input type="radio" name="quiz-tradeoff-rsn-${q.id}" value="${j}" />
               <span>${escapeHtml(rsn)}</span>
             </label>
           `).join('')}
         </div>
       `;
    }
    return html;
  }
  
  document.addEventListener('click', (e) => {
     if (e.target.closest('.quiz-up-btn')) {
        const btn = e.target.closest('.quiz-up-btn');
        const li = btn.closest('li');
        if (li.previousElementSibling) {
           li.parentNode.insertBefore(li, li.previousElementSibling);
        }
     } else if (e.target.closest('.quiz-down-btn')) {
        const btn = e.target.closest('.quiz-down-btn');
        const li = btn.closest('li');
        if (li.nextElementSibling) {
           li.parentNode.insertBefore(li.nextElementSibling, li);
        }
     } else if (e.target.closest('.quiz-submit-btn')) {
        const btn = e.target.closest('.quiz-submit-btn');
        const card = btn.closest('.quiz-card');
        const qid = btn.dataset.qid;
        const type = card.dataset.type;
        const slug = card.dataset.slug;
        const q = window.QUESTION_BANK[slug].find(x => x.id === qid);
        
        let correct = false;
        if (type === 'mcq') {
           const checked = card.querySelector(`input[name="quiz-${qid}"]:checked`);
           if (checked && parseInt(checked.value) === q.answer) correct = true;
        } else if (type === 'multi') {
           const checked = Array.from(card.querySelectorAll(`input[name="quiz-${qid}"]:checked`)).map(el => parseInt(el.value));
           if (checked.length === q.answer.length && checked.every(v => q.answer.includes(v))) correct = true;
        } else if (type === 'ordering') {
           const currentOrder = Array.from(card.querySelectorAll('.quiz-order-item')).map(el => parseInt(el.dataset.id));
           if (JSON.stringify(currentOrder) === JSON.stringify(q.answer)) correct = true;
        } else if (type === 'numeric') {
           const val = parseFloat(card.querySelector('.quiz-number-input').value);
           if (val === q.answer) correct = true;
        } else if (type === 'tradeoff') {
           const opt = card.querySelector(`input[name="quiz-tradeoff-opt-${qid}"]:checked`);
           const rsn = card.querySelector(`input[name="quiz-tradeoff-rsn-${qid}"]:checked`);
           if (opt && rsn && parseInt(opt.value) === q.answer.option && parseInt(rsn.value) === q.answer.reason) {
             correct = true;
           }
        }
        
        card.querySelectorAll('input, button:not(.quiz-next-btn)').forEach(el => el.disabled = true);

        // Show which option was right (and which pick was wrong)
        if (type === 'mcq') {
          card.querySelectorAll(`input[name="quiz-${qid}"]`).forEach(inp => {
            const label = inp.closest('.quiz-option-label');
            if (!label) return;
            if (parseInt(inp.value) === q.answer) label.classList.add('correct');
            else if (inp.checked) label.classList.add('incorrect');
          });
        }
        
        const fb = card.querySelector('.exercise-feedback');
        const msg = fb.querySelector('.feedback-msg');
        fb.style.display = 'block';
        fb.classList.add('show');
        if (correct) {
          fb.classList.add('success');
          msg.innerHTML = '<strong>✓ Correct!</strong>';
        } else {
          fb.classList.add('error');
          msg.innerHTML = '<strong>✗ Incorrect.</strong>';
        }
        
        const nextBtn = card.querySelector('.quiz-next-btn');
        if (nextBtn) nextBtn.style.display = 'inline-block';
        btn.style.display = 'none';
        
        if (window.Progress && window.Progress.recordQuizAttempt) {
           window.Progress.recordQuizAttempt(qid, correct);
        }
     } else if (e.target.closest('.quiz-next-btn')) {
        const btn = e.target.closest('.quiz-next-btn');
        const slug = btn.dataset.slug;
        const card = btn.closest('.quiz-card');
        
        const newHtml = renderQuiz(slug);
        const temp = document.createElement('div');
        temp.innerHTML = newHtml;
        card.replaceWith(temp.firstElementChild);
     }
  });

  /**
   * Compact self-check shown right after the section it tests (question.section = that <h2>'s text).
   * Reuses the quiz-card grading handler above.
   */
  function renderInlineCheck(q, slug) {
    return `
      <aside class="quiz-card inline-check" id="quiz-${q.id}" data-type="${q.type}" data-slug="${slug}" aria-label="Check yourself">
        <div class="inline-check__head">
          <span class="inline-check__label">Check yourself</span>
          <span class="inline-check__title">${escapeHtml(q.title || '')}</span>
          <span class="inline-check__level">${escapeHtml(q.difficulty || '')}</span>
        </div>
        <p class="inline-check__prompt">${escapeHtml(q.prompt)}</p>
        <div class="quiz-options inline-check__options">${renderOptions(q)}</div>
        <button class="btn btn--sm btn--primary quiz-submit-btn" data-qid="${q.id}">Check answer</button>
        <div class="exercise-feedback quiz-feedback inline-check__feedback" id="feedback-${q.id}" style="display: none;">
          <div class="feedback-msg"></div>
          <div class="feedback-exp">${escapeHtml(q.explanation)}</div>
        </div>
      </aside>`;
  }

  const headingText = html => html.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();

  /**
   * Insert this unit's section-anchored questions into lesson HTML, each at the end of its section
   * (just before the next <h2>, or at the end of the content).
   */
  function insertInlineChecks(html, slug) {
    const qs = (window.QUESTION_BANK?.[slug] || []).filter(q => q.section && q.type === 'mcq');
    if (!qs.length || !html) return html;
    const heads = [...html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/g)].map(m => ({ at: m.index, end: m.index + m[0].length, text: headingText(m[1]) }));
    const inserts = [];
    for (const q of qs) {
      const i = heads.findIndex(h => h.text === q.section);
      if (i < 0) continue;
      let pos = i + 1 < heads.length ? heads[i + 1].at : html.lastIndexOf('</div>');
      if (pos < heads[i].end) pos = html.length;
      inserts.push({ pos, html: renderInlineCheck(q, slug) });
    }
    // group by position (keeping question order), then apply from the end so earlier offsets stay valid
    const grouped = new Map();
    for (const ins of inserts) grouped.set(ins.pos, (grouped.get(ins.pos) || []).concat(ins.html));
    let out = html;
    for (const [pos, parts] of [...grouped.entries()].sort((a, b) => b[0] - a[0])) out = out.slice(0, pos) + parts.join('') + out.slice(pos);
    return out;
  }

  return {
    hasQuestions,
    hasEndQuestions,
    renderQuiz,
    renderInlineCheck,
    insertInlineChecks
  };
})();
