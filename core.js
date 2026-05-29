(function(){
        window.addEventListener('error', function(e){
            try{
                const m = document.getElementById('map');
                if (m) m.innerHTML = '<div style="color:#fff; padding:12px; text-align:center;">發生錯誤：' + (e && e.message ? e.message : e) + '<br/>請開啟 Console (F12) 查看詳情。</div>';
            }catch(err){}
            console.error('Global error caught:', e);
        });
        window.addEventListener('unhandledrejection', function(e){
            try{
                const m = document.getElementById('map');
                if (m) m.innerHTML = '<div style="color:#fff; padding:12px; text-align:center;">Promise 錯誤：' + (e && e.reason ? e.reason : e) + '<br/>請開啟 Console (F12) 查看詳情。</div>';
            }catch(err){}
            console.error('Unhandled rejection:', e);
        });
    })();

    let measurePoints = [];
    let measureMarkers = [];
    let courseMarkers = [];
    let userMarker = null;
    let isMeasureMode = false;
    let windMarker = null;
    let scorecardVisible = false;
    let positionWatchId = null;
    let currentCourse = 'suncity';
    let currentHistoryId = null;
    let selectedScorecardHole = null;

    const STORAGE_KEY_PREFIX = 'golfGpsScorecard_';
    const STORAGE_HISTORY_PREFIX = 'golfGpsHistory_';

    let scorecardDataMap = {};
    let scorecardData = null;
    let currentRoutingId = null;

    // 全域輔助訊息顯示函式
    function setInfo(text) {
        const info = document.getElementById('info-text');
        if (info) info.innerText = text;
    }

    function cloneCourseData(course) {
        return JSON.parse(JSON.stringify(course));
    }

    function getCurrentCourseMeta() {
        return scorecardDataMap[currentCourse] || null;
    }

    function getCurrentRoutingMeta() {
        const course = getCurrentCourseMeta();
        if (!course || !Array.isArray(course.routingOptions)) return null;
        return course.routingOptions.find(r => r.id === currentRoutingId) || null;
    }

    function getScorecardStorageKey() {
        return `${STORAGE_KEY_PREFIX}${currentCourse}__${currentRoutingId || 'default'}`;
    }

    function getHistoryStorageKey() {
        return `${STORAGE_HISTORY_PREFIX}${currentCourse}__${currentRoutingId || 'default'}`;
    }

    function buildScorecardData(course, routingId) {
        if (Array.isArray(course.holes)) {
            return cloneCourseData(course);
        }
        const routing = (course.routingOptions || []).find(r => r.id === routingId) || course.routingOptions?.[0];
        if (!routing) throw new Error('找不到球道路線設定');
        const front = course.zones[routing.frontZone];
        const back = course.zones[routing.backZone];
        if (!front || !back) throw new Error('路線區域資料缺失');

        const mapHole = (h, idx, zoneName) => ({
            number: idx + 1,
            par: h.par,
            hdcp: h.hdcp,
            distances: { blue: h.blue, white: h.white, red: h.red },
            score: null,
            putts: null,
            zone: zoneName,
            zoneHole: h.zoneHole
        });
        const frontHoles = front.holes.map((h, i) => mapHole(h, i, front.name));
        const backHoles = back.holes.map((h, i) => mapHole(h, i + 9, back.name));
        const sum = (arr, key) => arr.reduce((s, x) => s + (x[key] || 0), 0);
        const holes = [...frontHoles, ...backHoles];

        return {
            courseName: course.courseName,
            englishName: course.englishName || '',
            address: course.address || '',
            phone: course.phone || '',
            fax: course.fax || '',
            par: sum(holes, 'par'),
            routingId: routing.id,
            routingName: routing.name,
            front9Label: front.name,
            back9Label: back.name,
            front9Totals: { blue: front.total.blue, white: front.total.white, red: front.total.red, par: front.total.par },
            back9Totals: { blue: back.total.blue, white: back.total.white, red: back.total.red, par: back.total.par },
            holes
        };
    }

    function initCourseSelectOptions() {
        const select = document.getElementById('course-select');
        if (!select) return;
        const keys = Object.keys(scorecardDataMap);
        if (!keys.length) {
            select.innerHTML = '<option value="">無球場資料</option>';
            return;
        }
        select.innerHTML = keys.map((key) => `<option value="${key}">${scorecardDataMap[key].courseName}</option>`).join('');
        if (!scorecardDataMap[currentCourse]) currentCourse = keys[0];
        select.value = currentCourse;
    }

    function initRoutingOptions() {
        const row = document.getElementById('routing-row');
        const select = document.getElementById('routing-select');
        const course = getCurrentCourseMeta();
        if (!row || !select || !course) return;
        if (!Array.isArray(course.routingOptions) || course.routingOptions.length === 0) {
            row.style.display = 'none';
            select.innerHTML = '';
            currentRoutingId = null;
            return;
        }
        row.style.display = 'flex';
        select.innerHTML = course.routingOptions.map(r => `<option value="${r.id}">${r.name}</option>`).join('');
        currentRoutingId = course.routingOptions.some(r => r.id === currentRoutingId)
            ? currentRoutingId
            : (course.defaultRouting || course.routingOptions[0].id);
        select.value = currentRoutingId;
    }

    function renderCourseLinks() {
        const row = document.getElementById('course-links-row');
        const course = getCurrentCourseMeta();
        if (!row) return;

        row.innerHTML = '';
        const links = course && Array.isArray(course.courseLinks) ? course.courseLinks : [];
        if (!links.length) {
            row.style.display = 'none';
            return;
        }

        links.forEach((link) => {
            if (!link || !link.url) return;
            const a = document.createElement('a');
            a.className = `btn course-link-btn ${link.official === false ? 'course-link-secondary' : 'btn-green'}`;
            a.href = link.url;
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
            a.textContent = link.label || '球道資訊';
            a.title = link.note || link.url;
            row.appendChild(a);
        });

        row.style.display = row.children.length ? 'flex' : 'none';
    }

    async function loadCourseData() {
        const res = await fetch('./courses.json', { cache: 'no-cache' });
        if (!res.ok) throw new Error(`courses.json 載入失敗 (${res.status})`);
        const data = await res.json();
        if (!data || typeof data !== 'object' || !data.courses || typeof data.courses !== 'object') {
            throw new Error('courses.json 格式錯誤');
        }
        scorecardDataMap = data.courses;
        initCourseSelectOptions();
        initRoutingOptions();
        renderCourseLinks();
        scorecardData = buildScorecardData(scorecardDataMap[currentCourse], currentRoutingId);
        loadScorecardData();
    }

    function handleCourseChange() {
        if (!Object.keys(scorecardDataMap).length) return;
        const selected = document.getElementById('course-select').value;
        if (selected !== currentCourse) {
            currentCourse = selected;
            selectedScorecardHole = null;
            initRoutingOptions();
            renderCourseLinks();
            scorecardData = buildScorecardData(scorecardDataMap[currentCourse], currentRoutingId);
            loadScorecardData();
            if (scorecardVisible) {
                document.getElementById('coursecard-title').innerText = scorecardData.courseName + (scorecardData.routingName ? ` (${scorecardData.routingName})` : '') + ' - 分數卡';
                renderScorecard();
            }
            setInfo(`已切換至 ${scorecardData.courseName}`);
        }
    }

    function handleRoutingChange() {
        const select = document.getElementById('routing-select');
        if (!select) return;
        currentRoutingId = select.value || null;
        const course = getCurrentCourseMeta();
        if (!course) return;
        selectedScorecardHole = null;
        scorecardData = buildScorecardData(course, currentRoutingId);
        loadScorecardData();
        if (scorecardVisible) renderScorecard();
        const route = getCurrentRoutingMeta();
        setInfo(route ? `已切換路線：${route.name}` : '已切換路線');
    }
