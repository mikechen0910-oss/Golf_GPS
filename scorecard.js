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
                console.log('分數卡已加載：' + currentCourse);
            }
        } catch (e) {
            console.error('加載分數卡失敗:', e);
        }
    }

    function saveScorecardDraft() {
        try {
            const toSave = JSON.parse(JSON.stringify(scorecardData));
            localStorage.setItem(getScorecardStorageKey(), JSON.stringify(toSave));
            setInfo('💾 分數卡已暫存（未完賽）');
            console.log('分數卡暫存：' + getScorecardStorageKey());
        } catch (e) {
            console.error('暫存分數卡失敗:', e);
            setInfo('❌ 暫存失敗');
        }
    }

    function finishScorecard() {
        const totals = calculateScoreTotals();

        if (totals.playedCount === 0) {
            alert('請至少輸入一個洞的成績後再完賽');
            return;
        }

        const confirmed = confirm(`確定要完賽嗎？\n總桿數：${totals.totalStrokes}，成績：${totals.totalDiffLabel}`);
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
            setInfo(`✅ 完賽已保存！總桿數：${totals.totalStrokes}`);

            console.log('分數卡完賽保存：', historyRecord);
        } catch (e) {
            console.error('完賽保存失敗:', e);
            setInfo('❌ 完賽保存失敗');
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
                historyList.innerHTML = '<p style="color: #666; text-align: center;">暫無歷史紀錄</p>';
            } else {
                historyList.innerHTML = history.map(record => `
                    <div class="history-item" onclick="showHistoryDetail('${record.id}')">
                        <div class="history-item-title">${record.courseName}${record.routingName ? ' - ' + record.routingName : ''}</div>
                        <div class="history-item-date">📅 ${record.date}</div>
                        <div class="history-item-stats">
                            <span class="history-item-stat">🏌️ 桿數: ${record.totals.totalStrokes}</span>
                            <span class="history-item-stat">📍 ${record.totals.totalDiffLabel}</span>
                            <span class="history-item-stat">🎯 ${record.totals.playedCount}/18 洞</span>
                            <span class="history-item-stat">⛳ 推桿: ${record.totals.totalPutts}</span>
                        </div>
                    </div>
                `).join('');
            }

            document.getElementById('historyModal').style.display = 'block';
        } catch (e) {
            console.error('顯示歷史失敗:', e);
            alert('無法顯示歷史紀錄');
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
                    <span>總桿數：${totals.totalStrokes}</span>
                    <span>成績：${totals.totalDiffLabel}</span>
                    <span>已完成洞數：${totals.playedCount}/18</span>
                    <span>總推桿：${totals.totalPutts}</span>
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
                            <th>洞號</th>
                            <th>Par</th>
                            <th>碼數</th>
                            <th>桿數</th>
                            <th>差數</th>
                            <th>推桿</th>
                        </tr>
                    </thead>
                    <tbody>${rows || '<tr><td colspan="6" style="text-align: center;">無成績</td></tr>'}</tbody>
                </table>
            `;

            body.innerHTML = detailHtml;
            document.getElementById('historyDetailModal').style.display = 'block';
            document.getElementById('historyModal').style.display = 'none';
        } catch (e) {
            console.error('顯示詳細紀錄失敗:', e);
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

            setInfo('📥 JSON 檔案已下載');
        } catch (e) {
            console.error('匯出失敗:', e);
            alert('匯出失敗');
        }
    }

    function deleteHistoryRecord() {
        if (!confirm('確定要刪除此紀錄嗎？')) return;

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
            setInfo('✅ 紀錄已刪除');
        } catch (e) {
            console.error('刪除失敗:', e);
            alert('刪除失敗');
        }
    }

    function clearAllHistory() {
        if (!confirm('確定要清除所有歷史紀錄嗎？此操作無法恢復。')) return;

        try {
            const historyKey = getHistoryStorageKey();
            localStorage.removeItem(historyKey);

            const historyList = document.getElementById('history-list');
            historyList.innerHTML = '<p style="color: #666; text-align: center;">暫無歷史紀錄</p>';

            setInfo('✅ 所有歷史紀錄已清除');
        } catch (e) {
            console.error('清除歷史失敗:', e);
            alert('清除失敗');
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
        const confirmed = confirm('確定要清除所有分數記錄嗎？');
        if (!confirmed) return;

        scorecardData.holes.forEach(hole => {
            hole.score = null;
            hole.putts = null;
        });
        localStorage.removeItem(getScorecardStorageKey());
        renderScorecard();
        setInfo('✅ 所有分數已清除');
    }

    function toggleScorecard() {
        scorecardVisible = !scorecardVisible;
        document.getElementById('scorecard-panel').style.display = scorecardVisible ? 'block' : 'none';
        if (scorecardVisible) {
            document.getElementById('coursecard-title').innerText = scorecardData.courseName + (scorecardData.routingName ? ` (${scorecardData.routingName})` : '') + ' - 分數卡';
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
            <span>球場名稱：${scorecardData.courseName}</span>
            <span>${scorecardData.front9Label || '前九'}：${totals.frontPlayedCount ? totals.frontStrokes : '--'} (${totals.frontPlayedCount} 洞) / ${totals.frontPlayedCount ? totals.frontDiffLabel : '--'}</span>
            <span>${scorecardData.back9Label || '後九'}：${totals.backPlayedCount ? totals.backStrokes : '--'} (${totals.backPlayedCount} 洞) / ${totals.backPlayedCount ? totals.backDiffLabel : '--'}</span>
            <span>總桿數：${totals.playedCount ? totals.totalStrokes : '--'} (${totals.playedCount ? totals.totalDiffLabel : '--'})</span>
            <span>總推桿數：${totals.puttsCount ? totals.totalPutts : '--'}</span>
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
                            <button data-hole="${h.number}" data-field="score" data-action="minus" style="width:28px; height:28px; padding:0; border-radius:4px; border:1px solid #ccc; background:#fafafa; cursor:pointer; font-weight:bold;">−</button>
                            <input type="number" min="1" max="15" value="${scoreValue}" data-hole="${h.number}" data-field="score" class="hole-input" style="width:50px; padding:6px; border-radius:4px; border:1px solid #ddd; text-align:center;">
                            <button data-hole="${h.number}" data-field="score" data-action="plus" style="width:28px; height:28px; padding:0; border-radius:4px; border:1px solid #ccc; background:#fafafa; cursor:pointer; font-weight:bold;">+</button>
                            ${getScoreIcon(h)}
                        </div>
                    </td>
                    <td>
                        <div style="display:flex; align-items:center; justify-content:center; gap:4px;">
                            <button data-hole="${h.number}" data-field="putts" data-action="minus" style="width:28px; height:28px; padding:0; border-radius:4px; border:1px solid #ccc; background:#fafafa; cursor:pointer; font-weight:bold;">−</button>
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
                        <th>洞號</th>
                        <th>標準桿</th>
                        <th>桿差</th>
                        <th>藍標</th>
                        <th>白標</th>
                        <th>紅標</th>
                        <th>桿數</th>
                        <th>推桿</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
                <tfoot>
                    <tr>
                        <td colspan="3">${scorecardData.front9Label || '前九'}</td>
                        <td>${scorecardData.front9Totals.blue}</td>
                        <td>${scorecardData.front9Totals.white}</td>
                        <td>${scorecardData.front9Totals.red}</td>
                    </tr>
                    <tr>
                        <td colspan="3">${scorecardData.back9Label || '後九'}</td>
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
        setInfo(`已選擇第 ${number} 洞`);
    }

    function updateHoleValue(number, field, value) {
        const hole = scorecardData.holes.find(h => h.number === number);
        hole[field] = value ? Number(value) : null;
        renderScorecard();
        const label = field === 'score' ? '桿數' : '推桿';
        setInfo(`已更新第 ${number} 洞 ${label}：${value || '未輸入'}`);
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
            return `<span style="${baseStyle}" title="低於標準桿 (Eagle+)">` +
                         `<svg width="${size}" height="${size}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">` +
                         `<circle cx="12" cy="12" r="9" fill="none" stroke="#0b5" stroke-width="1.6"/>` +
                         `<circle cx="12" cy="12" r="5" fill="none" stroke="#0b5" stroke-width="1.4"/>` +
                         `</svg></span>`;
        }
        if (diff === -1) {
            return `<span style="${baseStyle}" title="低於標準桿 (Birdie)">` +
                         `<svg width="${size}" height="${size}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">` +
                         `<circle cx="12" cy="12" r="7" fill="none" stroke="#09f" stroke-width="1.8"/>` +
                         `</svg></span>`;
        }
        if (diff === 0) {
            return `<span style="${baseStyle}" title="平標準桿">` +
                         `<svg width="${size}" height="${size}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">` +
                         `<polygon points="12,5 19,18 5,18" fill="none" stroke="#333" stroke-width="1.6"/>` +
                         `</svg></span>`;
        }
        if (diff === 1) {
            return `<span style="${baseStyle}" title="高於標準桿 (Bogey)">` +
                         `<svg width="${size}" height="${size}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">` +
                         `<rect x="6" y="6" width="12" height="12" fill="none" stroke="#f55" stroke-width="1.6"/>` +
                         `</svg></span>`;
        }
        if (diff >= 2) {
            return `<span style="${baseStyle}" title="高於標準桿 (+${diff})">` +
                         `<svg width="${size}" height="${size}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">` +
                         `<rect x="3" y="3" width="18" height="18" fill="none" stroke="#f00" stroke-width="1.4"/>` +
                         `<rect x="8" y="8" width="8" height="8" fill="none" stroke="#f00" stroke-width="1.2"/>` +
                         `</svg></span>`;
        }
        return '';
    }
