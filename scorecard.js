    function loadScorecardData() {
        if (!scorecardData || !Array.isArray(scorecardData.holes)) return;
        try {
            const saved = localStorage.getItem(getScorecardStorageKey());
            if (saved) {
                const data = JSON.parse(saved);
                scorecardData.holes.forEach((hole) => {
                    const savedHole = data.holes.find(h => h.number === hole.number);
                    if (savedHole) {
                        hole.score = savedHole.score;
                        hole.putts = savedHole.putts;
                    }
                });
                console.log('??∪歇??嚗? + currentCourse);
            }
        } catch (e) {
            console.error('????∪仃??', e);
        }
    }

    function saveScorecardDraft() {
        try {
            const toSave = JSON.parse(JSON.stringify(scorecardData));
            localStorage.setItem(getScorecardStorageKey(), JSON.stringify(toSave));
            setInfo('? ??∪歇?怠?嚗摰魚嚗?);
            console.log('??⊥摮?' + getScorecardStorageKey());
        } catch (e) {
            console.error('?怠???∪仃??', e);
            setInfo('???怠?憭望?');
        }
    }

    function finishScorecard() {
        const totals = calculateScoreTotals();

        if (totals.playedCount === 0) {
            alert('隢撠撓?乩?????蝮曉???鞈?);
            return;
        }

        const confirmed = confirm(`蝣箏?閬?鞈賢?嚗n蝮賣▼?賂?${totals.totalStrokes}嚗?蝮橘?${totals.totalDiffLabel}`);
        if (!confirmed) return;

        try {
            const now = new Date();
            const timestamp = now.getTime();
            const dateStr = now.toLocaleString('zh-TW');

            const historyRecord = {
                id: timestamp,
                course: currentCourse,
                courseName: scorecardData.courseName,
                routingId: currentRoutingId,
                routingName: scorecardData.routingName || null,
                date: dateStr,
                timestamp: timestamp,
                holes: JSON.parse(JSON.stringify(scorecardData.holes)),
                totals: totals
            };

            let history = [];
            const historyKey = getHistoryStorageKey();
            const savedHistory = localStorage.getItem(historyKey);
            if (savedHistory) {
                history = JSON.parse(savedHistory);
            }

            history.push(historyRecord);
            localStorage.setItem(historyKey, JSON.stringify(history));

            localStorage.removeItem(getScorecardStorageKey());

            scorecardData.holes.forEach(hole => {
                hole.score = null;
                hole.putts = null;
            });

            renderScorecard();
            setInfo(`??摰魚撌脖?摮?蝮賣▼?賂?${totals.totalStrokes}`);

            console.log('??∪?鞈賭?摮?', historyRecord);
        } catch (e) {
            console.error('摰魚靽?憭望?:', e);
            setInfo('??摰魚靽?憭望?');
        }
    }

    function showHistory() {
        try {
            const historyKey = getHistoryStorageKey();
            let history = [];
            const savedHistory = localStorage.getItem(historyKey);
            if (savedHistory) {
                history = JSON.parse(savedHistory);
            }

            history.sort((a, b) => b.timestamp - a.timestamp);

            const historyList = document.getElementById('history-list');
            if (history.length === 0) {
                historyList.innerHTML = '<p style="color: #666; text-align: center;">?怎甇瑕蝝??/p>';
            } else {
                historyList.innerHTML = history.map(record => `
                    <div class="history-item" onclick="showHistoryDetail('${record.id}')">
                        <div class="history-item-title">${record.courseName}${record.routingName ? ' - ' + record.routingName : ''}</div>
                        <div class="history-item-date">?? ${record.date}</div>
                        <div class="history-item-stats">
                            <span class="history-item-stat">??儭?獢踵: ${record.totals.totalStrokes}</span>
                            <span class="history-item-stat">?? ${record.totals.totalDiffLabel}</span>
                            <span class="history-item-stat">? ${record.totals.playedCount}/18 瘣?/span>
                            <span class="history-item-stat">???冽▼: ${record.totals.totalPutts}</span>
                        </div>
                    </div>
                `).join('');
            }

            document.getElementById('historyModal').style.display = 'block';
        } catch (e) {
            console.error('憿舐內甇瑕憭望?:', e);
            alert('?⊥?憿舐內甇瑕蝝??);
        }
    }

    function showHistoryDetail(recordId) {
        try {
            const historyKey = getHistoryStorageKey();
            const savedHistory = localStorage.getItem(historyKey);
            if (!savedHistory) return;

            const history = JSON.parse(savedHistory);
            const record = history.find(r => r.id == recordId);
            if (!record) return;

            currentHistoryId = recordId;

            const title = document.getElementById('historyDetailTitle');
            title.innerText = `${record.courseName}${record.routingName ? ' - ' + record.routingName : ''} - ${record.date}`;

            const body = document.getElementById('historyDetailBody');
            const totals = record.totals;

            let statsHtml = `
                <div class="scorecard-summary">
                    <span>蝮賣▼?賂?${totals.totalStrokes}</span>
                    <span>?蜀嚗?{totals.totalDiffLabel}</span>
                    <span>撌脣????賂?${totals.playedCount}/18</span>
                    <span>蝮賣獢選?${totals.totalPutts}</span>
                </div>
            `;

            const rows = record.holes.filter(h => h.score !== null && h.score !== undefined).map(h => {
                const scoreValue = h.score !== null && h.score !== undefined ? h.score : '--';
                const puttsValue = h.putts !== null && h.putts !== undefined ? h.putts : '--';
                const diff = h.score - h.par;
                const diffLabel = diff === 0 ? 'E' : diff > 0 ? `+${diff}` : `${diff}`;
                return `
                    <tr>
                        <td>${h.number}</td>
                        <td>${h.par}</td>
                        <td>${h.distances.blue}</td>
                        <td style="font-weight: bold; color: ${diff < 0 ? '#00b050' : diff > 0 ? '#ff0000' : '#000'}">${scoreValue}</td>
                        <td>${diffLabel}</td>
                        <td>${puttsValue}</td>
                    </tr>
                `;
            }).join('');

            const detailHtml = `
                ${statsHtml}
                <table class="scorecard-table">
                    <thead>
                        <tr>
                            <th>瘣?</th>
                            <th>Par</th>
                            <th>蝣潭</th>
                            <th>獢踵</th>
                            <th>撌格</th>
                            <th>?冽▼</th>
                        </tr>
                    </thead>
                    <tbody>${rows || '<tr><td colspan="6" style="text-align: center;">?⊥?蝮?/td></tr>'}</tbody>
                </table>
            `;

            body.innerHTML = detailHtml;
            document.getElementById('historyDetailModal').style.display = 'block';
            document.getElementById('historyModal').style.display = 'none';
        } catch (e) {
            console.error('憿舐內閰喟敦蝝?仃??', e);
        }
    }

    function exportAsJSON() {
        try {
            const historyKey = getHistoryStorageKey();
            const savedHistory = localStorage.getItem(historyKey);
            if (!savedHistory) return;

            const history = JSON.parse(savedHistory);
            const record = history.find(r => r.id == currentHistoryId);
            if (!record) return;

            const jsonStr = JSON.stringify(record, null, 2);
            const blob = new Blob([jsonStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${record.courseName}_${record.date.replace(/[\/\s:]/g, '_')}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            setInfo('? JSON 瑼?撌脖?頛?);
        } catch (e) {
            console.error('?臬憭望?:', e);
            alert('?臬憭望?');
        }
    }

    function deleteHistoryRecord() {
        if (!confirm('蝣箏?閬?斗迨蝝??嚗?)) return;

        try {
            const historyKey = getHistoryStorageKey();
            let history = [];
            const savedHistory = localStorage.getItem(historyKey);
            if (savedHistory) {
                history = JSON.parse(savedHistory);
            }

            history = history.filter(r => r.id != currentHistoryId);

            if (history.length === 0) {
                localStorage.removeItem(historyKey);
            } else {
                localStorage.setItem(historyKey, JSON.stringify(history));
            }

            closeHistoryDetail();
            showHistory();
            setInfo('??蝝?歇?芷');
        } catch (e) {
            console.error('?芷憭望?:', e);
            alert('?芷憭望?');
        }
    }

    function clearAllHistory() {
        if (!confirm('蝣箏?閬??斗??風?脩???嚗迨???⊥??Ｗ儔??)) return;

        try {
            const historyKey = getHistoryStorageKey();
            localStorage.removeItem(historyKey);

            const historyList = document.getElementById('history-list');
            historyList.innerHTML = '<p style="color: #666; text-align: center;">?怎甇瑕蝝??/p>';

            setInfo('????風?脩??歇皜');
        } catch (e) {
            console.error('皜甇瑕憭望?:', e);
            alert('皜憭望?');
        }
    }

    function closeHistory() {
        document.getElementById('historyModal').style.display = 'none';
    }

    function closeHistoryDetail() {
        document.getElementById('historyDetailModal').style.display = 'none';
        currentHistoryId = null;
    }

    function clearScorecard() {
        const confirmed = confirm('蝣箏?閬??斗????貉???嚗?);
        if (!confirmed) return;

        scorecardData.holes.forEach(hole => {
            hole.score = null;
            hole.putts = null;
        });
        localStorage.removeItem(getScorecardStorageKey());
        renderScorecard();
        setInfo('??????詨歇皜');
    }

    function toggleScorecard() {
        scorecardVisible = !scorecardVisible;
        document.getElementById('scorecard-panel').style.display = scorecardVisible ? 'block' : 'none';
        if (scorecardVisible) {
            document.getElementById('coursecard-title').innerText = scorecardData.courseName + (scorecardData.routingName ? ` (${scorecardData.routingName})` : '') + ' - ???;
            renderScorecard();
        }
    }

    function handleHoleSelectChange() {
        renderFeatures();
        if (scorecardVisible) renderScorecard();
    }

    function renderScorecard() {
        const summary = document.getElementById('scorecard-summary');
        const content = document.getElementById('scorecard-content');
        const selectedHole = document.getElementById('hole-select').value;
        const totals = calculateScoreTotals();

        summary.innerHTML = `
            <span>??迂嚗?{scorecardData.courseName}</span>
            <span>${scorecardData.front9Label || '??'}嚗?{totals.frontPlayedCount ? totals.frontStrokes : '--'} (${totals.frontPlayedCount} 瘣? / ${totals.frontPlayedCount ? totals.frontDiffLabel : '--'}</span>
            <span>${scorecardData.back9Label || '敺?'}嚗?{totals.backPlayedCount ? totals.backStrokes : '--'} (${totals.backPlayedCount} 瘣? / ${totals.backPlayedCount ? totals.backDiffLabel : '--'}</span>
            <span>蝮賣▼?賂?${totals.playedCount ? totals.totalStrokes : '--'} (${totals.playedCount ? totals.totalDiffLabel : '--'})</span>
            <span>蝮賣獢踵嚗?{totals.puttsCount ? totals.totalPutts : '--'}</span>
        `;

        const rows = scorecardData.holes.map(h => {
            const activeClass = selectedHole === String(h.number) ? 'scorecard-row active' : 'scorecard-row';
            const scoreValue = h.score !== null && h.score !== undefined ? h.score : '';
            const puttsValue = h.putts !== null && h.putts !== undefined ? h.putts : '';
            return `
                <tr class="${activeClass}" onclick="selectHole(${h.number})">
                    <td>${h.number}</td>
                    <td>${h.par}</td>
                    <td>${h.hdcp}</td>
                    <td>${h.distances.blue}</td>
                    <td>${h.distances.white}</td>
                    <td>${h.distances.red}</td>
                    <td>
                        <div style="display:flex; align-items:center; justify-content:center; gap:4px;">
                            <button data-hole="${h.number}" data-field="score" data-action="minus" style="width:28px; height:28px; padding:0; border-radius:4px; border:1px solid #ccc; background:#fafafa; cursor:pointer; font-weight:bold;">??/button>
                            <input type="number" min="1" max="15" value="${scoreValue}" data-hole="${h.number}" data-field="score" class="hole-input" style="width:50px; padding:6px; border-radius:4px; border:1px solid #ddd; text-align:center;">
                            <button data-hole="${h.number}" data-field="score" data-action="plus" style="width:28px; height:28px; padding:0; border-radius:4px; border:1px solid #ccc; background:#fafafa; cursor:pointer; font-weight:bold;">+</button>
                            ${getScoreIcon(h)}
                        </div>
                    </td>
                    <td>
                        <div style="display:flex; align-items:center; justify-content:center; gap:4px;">
                            <button data-hole="${h.number}" data-field="putts" data-action="minus" style="width:28px; height:28px; padding:0; border-radius:4px; border:1px solid #ccc; background:#fafafa; cursor:pointer; font-weight:bold;">??/button>
                            <input type="number" min="0" max="10" value="${puttsValue}" data-hole="${h.number}" data-field="putts" class="hole-input" style="width:50px; padding:6px; border-radius:4px; border:1px solid #ddd; text-align:center;">
                            <button data-hole="${h.number}" data-field="putts" data-action="plus" style="width:28px; height:28px; padding:0; border-radius:4px; border:1px solid #ccc; background:#fafafa; cursor:pointer; font-weight:bold;">+</button>
                        </div>
                    </td>
                </tr>`;
        }).join('');

        content.innerHTML = `
            <table class="scorecard-table">
                <thead>
                    <tr>
                        <th>瘣?</th>
                        <th>璅?獢?/th>
                        <th>獢踹榆</th>
                        <th>??</th>
                        <th>?賣?</th>
                        <th>蝝?</th>
                        <th>獢踵</th>
                        <th>?冽▼</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
                <tfoot>
                    <tr>
                        <td colspan="3">${scorecardData.front9Label || '??'}</td>
                        <td>${scorecardData.front9Totals.blue}</td>
                        <td>${scorecardData.front9Totals.white}</td>
                        <td>${scorecardData.front9Totals.red}</td>
                    </tr>
                    <tr>
                        <td colspan="3">${scorecardData.back9Label || '敺?'}</td>
                        <td>${scorecardData.back9Totals.blue}</td>
                        <td>${scorecardData.back9Totals.white}</td>
                        <td>${scorecardData.back9Totals.red}</td>
                    </tr>
                </tfoot>
            </table>
        `;

        setTimeout(() => {
            const inputs = content.querySelectorAll('.hole-input');

            inputs.forEach(input => {
                const handleChange = () => {
                    const hole = parseInt(input.dataset.hole, 10);
                    const field = input.dataset.field;
                    const value = input.value;
                    updateHoleValue(hole, field, value);
                };
                input.addEventListener('input', handleChange);
                input.addEventListener('change', handleChange);
                input.addEventListener('blur', handleChange);
            });

            content.querySelectorAll('button[data-action]').forEach((btn) => {
                btn.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();

                    const hole = parseInt(this.dataset.hole, 10);
                    const field = String(this.dataset.field).trim();
                    const action = String(this.dataset.action).trim();

                    const hole_obj = scorecardData.holes.find(h => h.number === hole);
                    if (!hole_obj) {
                        console.warn('Hole not found:', hole);
                        return;
                    }

                    const currentValue = (hole_obj[field] !== null && hole_obj[field] !== undefined) ? Number(hole_obj[field]) : 0;
                    let newValue = currentValue;

                    if (action === 'plus') {
                        newValue = currentValue + 1;
                        if (field === 'score' && newValue > 15) newValue = 15;
                        if (field === 'putts' && newValue > 10) newValue = 10;
                    } else if (action === 'minus') {
                        newValue = Math.max(field === 'score' ? 1 : 0, currentValue - 1);
                    }

                    console.log(`Updating hole ${hole}, field ${field} to ${newValue}`);
                    updateHoleValue(hole, field, newValue);
                }, false);
            });
        }, 10);
    }

    function selectHole(number) {
        document.getElementById('hole-select').value = number;
        renderFeatures();
        renderScorecard();
        setInfo(`撌脤?洵 ${number} 瘣);
    }

    function updateHoleValue(number, field, value) {
        const hole = scorecardData.holes.find(h => h.number === number);
        hole[field] = value ? Number(value) : null;
        renderScorecard();
        const label = field === 'score' ? '獢踵' : '?冽▼';
        setInfo(`撌脫?啁洵 ${number} 瘣?${label}嚗?{value || '?芾撓??}`);
    }

    function calculateScoreTotals() {
        const frontHoles = scorecardData.holes.slice(0, 9);
        const backHoles = scorecardData.holes.slice(9, 18);
        const frontPlayedHoles = frontHoles.filter(h => h.score !== null && h.score !== undefined && h.score !== '');
        const backPlayedHoles = backHoles.filter(h => h.score !== null && h.score !== undefined && h.score !== '');
        const totalPlayedHoles = scorecardData.holes.filter(h => h.score !== null && h.score !== undefined && h.score !== '');
        const frontStrokes = frontPlayedHoles.reduce((sum, h) => sum + h.score, 0);
        const backStrokes = backPlayedHoles.reduce((sum, h) => sum + h.score, 0);
        const frontPutts = frontHoles.filter(h => h.putts !== null && h.putts !== undefined && h.putts !== '').reduce((sum, h) => sum + h.putts, 0);
        const backPutts = backHoles.filter(h => h.putts !== null && h.putts !== undefined && h.putts !== '').reduce((sum, h) => sum + h.putts, 0);
        const totalStrokes = frontStrokes + backStrokes;
        const totalPutts = frontPutts + backPutts;
        const puttsCount = scorecardData.holes.filter(h => h.putts !== null && h.putts !== undefined && h.putts !== '').length;
        const frontPar = frontPlayedHoles.reduce((sum, h) => sum + h.par, 0);
        const backPar = backPlayedHoles.reduce((sum, h) => sum + h.par, 0);
        const totalPar = totalPlayedHoles.reduce((sum, h) => sum + h.par, 0);
        const frontDiff = frontStrokes - frontPar;
        const backDiff = backStrokes - backPar;
        const totalDiff = totalStrokes - totalPar;
        const formatDiff = diff => diff === 0 ? 'E' : diff > 0 ? `+${diff}` : `${diff}`;
        return {
            totalStrokes,
            totalPutts,
            puttsCount,
            playedCount: totalPlayedHoles.length,
            frontStrokes,
            backStrokes,
            frontPutts,
            backPutts,
            frontPlayedCount: frontPlayedHoles.length,
            backPlayedCount: backPlayedHoles.length,
            frontDiffLabel: frontPlayedHoles.length ? formatDiff(frontDiff) : '--',
            backDiffLabel: backPlayedHoles.length ? formatDiff(backDiff) : '--',
            totalDiffLabel: totalPlayedHoles.length ? formatDiff(totalDiff) : '--'
        };
    }

    function getScoreIcon(h) {
        if (h.score === null || h.score === undefined || h.score === '') return '';
        const diff = h.score - h.par;
        const size = 18;
        const baseStyle = 'vertical-align:middle; margin-left:8px; display:inline-block;';
        if (diff <= -2) {
            return `<span style="${baseStyle}" title="雿璅?獢?(Eagle+)">` +
                         `<svg width="${size}" height="${size}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">` +
                         `<circle cx="12" cy="12" r="9" fill="none" stroke="#0b5" stroke-width="1.6"/>` +
                         `<circle cx="12" cy="12" r="5" fill="none" stroke="#0b5" stroke-width="1.4"/>` +
                         `</svg></span>`;
        }
        if (diff === -1) {
            return `<span style="${baseStyle}" title="雿璅?獢?(Birdie)">` +
                         `<svg width="${size}" height="${size}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">` +
                         `<circle cx="12" cy="12" r="7" fill="none" stroke="#09f" stroke-width="1.8"/>` +
                         `</svg></span>`;
        }
        if (diff === 0) {
            return `<span style="${baseStyle}" title="撟單?皞▼">` +
                         `<svg width="${size}" height="${size}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">` +
                         `<polygon points="12,5 19,18 5,18" fill="none" stroke="#333" stroke-width="1.6"/>` +
                         `</svg></span>`;
        }
        if (diff === 1) {
            return `<span style="${baseStyle}" title="擃璅?獢?(Bogey)">` +
                         `<svg width="${size}" height="${size}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">` +
                         `<rect x="6" y="6" width="12" height="12" fill="none" stroke="#f55" stroke-width="1.6"/>` +
                         `</svg></span>`;
        }
        if (diff >= 2) {
            return `<span style="${baseStyle}" title="擃璅?獢?(+${diff})">` +
                         `<svg width="${size}" height="${size}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">` +
                         `<rect x="3" y="3" width="18" height="18" fill="none" stroke="#f00" stroke-width="1.4"/>` +
                         `<rect x="8" y="8" width="8" height="8" fill="none" stroke="#f00" stroke-width="1.2"/>` +
                         `</svg></span>`;
        }
        return '';
    }
