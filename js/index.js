const button = document.querySelector('[data-bs-target="#detallesContent"]');
const icon = button.querySelector('i');
const detalle = document.getElementById('detallesContent');

detalle.addEventListener('show.bs.collapse', () => {
    icon.classList.replace('bi-chevron-down', 'bi-chevron-up');
    localStorage.setItem('detalle', true);
});

detalle.addEventListener('hide.bs.collapse', () => {
    icon.classList.replace('bi-chevron-up', 'bi-chevron-down');
    localStorage.setItem('detalle', false);
});

if (localStorage.getItem('detalle')) button.click();

const logs = [];

function renderLogLine(log) {
    const consoleText = document.getElementById('consoleText');
    const classes = {
        info: 'text-muted',
        warning: 'text-warning',
        error: 'text-danger',
        success: 'text-success',
        system: 'text-primary'
    };
    const p = document.createElement('p');
    p.className = `small m-0 ${classes[log.type] || 'text-muted'}`;
    p.textContent = `[${log.type.toUpperCase()}] ${log.text} (${log.time})`;
    consoleText.appendChild(p);
}

function log(text, type = "info") {
    const hora = new Date().toLocaleTimeString();
    logs.push({
        type,
        text,
        time: hora
    });
    updateLogView();
}

function getActiveLogTypes() {
    return Array.from(document.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);
}

function updateLogView() {
    const consoleText = document.getElementById('consoleText');
    consoleText.innerHTML = '';
    const activeTypes = getActiveLogTypes();
    logs.filter(log => activeTypes.includes(log.type)).forEach(renderLogLine);
}

document.getElementById('status-section').innerHTML = "<p class='mb-0 text-center'>Cargando...</p>";
log("DOMContent loadind", 'info');

async function getComponents() {
    const statusDotGeneral = document.getElementById('status-dot-general');
    const statusTextGeneral = document.getElementById('status-text-general');
    const statusInfoGeneral = document.getElementById('status-info-general');
    const statusSection = document.getElementById('status-section');
    let time = performance.now();
    let service;
    let index = 0;
    let status = {
       'operational': 0,
       'failed': 0,
       'components': 0
    };
    try {
        log('Loading components.json', 'info');
        const response = await fetch(`/json/components.json`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) throw new Error(`Invalid content-type: ${contentType}`);
        const data = await response.json();
        service = data.service;
        log('components.json loaded successfully', 'success');
    } catch (error) {
        log(`Failed to load components.json: ${error.message}`, 'error');
        return
    }
    service.forEach(async e => {
        try {
            log(`Service check started: ${e.name}`, 'info');
            const groups = e.groups['0'];
            const components = groups.components;
            status.components += components.length;
            const result = await getComponentStatus(e.domain, e.name);
            const mainCard = document.createElement('div');
            mainCard.classList = "mb-3";
            mainCard.innerHTML = `
                <div class="mb-3">
                    <div class="card mb-2">
                        <div class="card-body d-flex justify-content-between align-items-center">
                            <div>
                                <h6 class="mb-0">${e.name}</h6>
                                <small class="text-muted">${components.length} componentes</small>
                            </div>
                            <div>
                                <span class="badge bg-secondary" id="badge-${groups.id}"></span>
                            </div>
                        </div>
                    </div>
                    <div class="d-flex flex-wrap gap-2 justify-content-center" id="content-${groups.id}">
                        <p class="gx-5">Obteniendo componentes...</p>
                    </div>
                </div>
            `;
            if (statusSection.innerHTML.includes('Cargando...')) statusSection.innerHTML = "";
            statusSection.append(mainCard);
            const badgeSpan = document.getElementById('badge-' + groups.id);
            if (result.status === 'operational') {
                badgeSpan.textContent = "Operativo";
                badgeSpan.classList.remove('bg-secundary');
                badgeSpan.classList.add('bg-success');
                status.operational += 1;
            } else if (result.status === 'degraded') {
                badgeSpan.textContent = "Operativo";
                badgeSpan.classList.remove('bg-secundary');
                badgeSpan.classList.add('bg-warning');
                status.operational += 1;
            } else if (result.status === 'error') {
                badgeSpan.textContent = "Falló";
                badgeSpan.classList.remove('bg-secundary');
                badgeSpan.classList.add('bg-danger');
                statusDotGeneral.classList.add('status-down');
                statusTextGeneral.classList.add('text-danger');
                statusTextGeneral.textContent = "Error crítico";
                statusInfoGeneral.textContent = "Estamos experimentando una interrupción en uno o más servicios principales.";
                status.failed += 1;
            }
            components.forEach(async e => {
                try {
                    log(`Service check started: ${e.name}`, 'info');
                    const result = await getComponentStatus(e.url, e.name);
                    index += 1;
                    const contentGroup = document.getElementById('content-' + groups.id);
                    const componentsCard = document.createElement('div');
                    componentsCard.classList = 'card component-card col-md-5 componentCard';
                    componentsCard.innerHTML = `
                        <div class="card-body d-flex justify-content-between align-items-center">
                            <div>
                                <div class="d-flex align-items-center">
                                    <span class="status-dot status-muted" id="status-dot-${e.id}"></span>
                                    <strong>${e.name}</strong>
                                </div>
                                <small class="text-muted" id="status-info-${e.id}"></small>
                            </div>
                        </div>
                    `;
                    if (contentGroup.innerHTML.includes('Obteniendo componentes...')) contentGroup.innerHTML = "";
                    contentGroup.appendChild(componentsCard);
                    const statusDot = document.getElementById('status-dot-' + e.id);
                    const statusInfo = document.getElementById('status-info-' + e.id);
                    if (result.status === 'operational') {
                        statusInfo.textContent = `Latencia: ~${result.responseTime}ms. Operativo.`;
                        statusDot.classList.remove('status-muted');
                        statusDot.classList.add('status-up');
                        status.operational += 1;
                        if (statusTextGeneral.textContent.includes("Error")) return;
                        statusDotGeneral.classList.add('status-up');
                        statusTextGeneral.classList.add('text-success');
                        statusTextGeneral.textContent = "Operativo";
                        statusInfoGeneral.textContent = "Todos los sistemas están funcionando con normalidad.";
                    } else if (result.status === 'degraded') {
                        statusInfo.textContent = `Latencia: ~${result.responseTime}ms. Operativo.`;
                        statusDot.classList.remove('status-muted');
                        statusDot.classList.add('status-degraded');
                        status.operational += 1;
                        if (statusTextGeneral.textContent.includes("Error")) return;
                        statusDotGeneral.classList.add('status-up');
                        statusTextGeneral.classList.add('text-success');
                        statusTextGeneral.textContent = "Operativo";
                        statusInfoGeneral.textContent = "Todos los sistemas están funcionando con normalidad.";
                    } else if (result.status === 'error') {
                        statusInfo.textContent = `Latencia: ~${result.responseTime}ms. Falló.`;
                        statusDot.classList.remove('status-muted');
                        statusDot.classList.add('status-down');
                        status.failed += 1;
                        if (statusTextGeneral.textContent.includes("Error")) return;
                        statusDotGeneral.classList.add('status-degraded');
                        statusTextGeneral.classList.add('text-warning');
                        statusTextGeneral.textContent = "Error menor";
                        statusInfoGeneral.textContent = "Estamos experimentando una interrupción menor en algunos de nuestros componentes.";
                    }
                } catch (error) {
                    log(`Service render failed (${e.name}): ${error.message}`, 'error');        
                } finally {
                    log(`Service check finished: ${e.name}`, 'system');
                    if (status.components === index) log(`Status evaluation completed: ${status.operational} operational, ${status.failed} failed (duration: ${Math.round(performance.now() - time)}ms)`, 'system');
                }
            })
        } catch (error) {
            log(`Service render failed (${e.name}): ${error.message}`, 'error');
        } finally {
            log(`Service check finished: ${e.name}`, 'system');
        } 
    });
}

async function getComponentStatus(component, name) {
    const time = performance.now();
    try {
        await fetch(component, {
            method: "GET",
            mode: "no-cors",
            cache: "no-store"
        });
        const latency = Math.round(performance.now() - time);
        log(`Component loaded successfully: ${name} (~${latency}ms)`, 'success');
        return {
            status: latency < 500 ? "operational" : "degraded",
            responseTime: latency
        };
    } catch (e) {
        log(`Health check failed (${name}): ${e}`, 'error');
        return {
            status: "error",
            responseTime: 0
        };
    }
}

async function checkInternetSpeed() {
    const time = performance.now();
    return fetch('https://www.google.com/', {cache: 'no-cache', mode: "no-cors"})
    .then(() => {
        const latency = Math.round(performance.now() - time);
        log(`Network latency test completed (${latency}ms)`, 'system');
        return latency;
    })
    .catch((e) => {
        log(`Network latency test failed: ${e.message}`, 'error');
        return Infinity;
    });
}

setTimeout(() => {
    const statusSection = document.getElementById('status-section');
    if (!statusSection.innerHTML.includes("Cargando...")) return;
    log("DOMContent loading slower than expected", 'warning');
    const warningText = document.createElement('p');
    warningText.classList = "m-0 text-center"
    warningText.innerHTML = "Carga lenta. Puede que los componentes tarden en cargar más de lo normal.";
    statusSection.appendChild(warningText); 
}, 5000);

window.onload = async () => {
    log("DOMContent loaded", 'success');
    await checkInternetSpeed();
    log("Status evaluation started", 'info');
    getComponents();
}