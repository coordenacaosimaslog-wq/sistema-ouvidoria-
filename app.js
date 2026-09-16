// --- Firebase Config ---
const firebaseConfig = {
  apiKey: "AIzaSyDKZc-I2nba3VN8_2uDoTyDxSQEkDxyDLI",
  authDomain: "simas-ouvidoria.firebaseapp.com",
  projectId: "simas-ouvidoria",
  storageBucket: "simas-ouvidoria.firebasestorage.app",
  messagingSenderId: "718073106066",
  appId: "1:718073106066:web:8fdbe7622167039ae8204b"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

document.addEventListener('DOMContentLoaded', () => {
    // --- Elements ---
    const form = document.getElementById('complaintForm');
    const modal = document.getElementById('successModal');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const navLinks = document.querySelectorAll('.nav-links a');
    const views = document.querySelectorAll('.view-section');
    
    // Dashboard Elements
    const kpiTotal = document.getElementById('kpi-total');
    const kpiOpen = document.getElementById('kpi-open');
    const kpiClosed = document.getElementById('kpi-closed');
    const tableBody = document.getElementById('complaintsTableBody');
    const emptyState = document.getElementById('emptyState');
    
    // Backup Elements
    const btnExport = document.getElementById('btnExport');
    const importFile = document.getElementById('importFile');
    
    // Custom Category Logic
    const categorySelect = document.getElementById('category');
    const categoryOtherInput = document.getElementById('category_other');
    
    categorySelect.addEventListener('change', (e) => {
        if (e.target.value === 'OUTROS') {
            categoryOtherInput.style.display = 'block';
            categoryOtherInput.required = true;
        } else {
            categoryOtherInput.style.display = 'none';
            categoryOtherInput.required = false;
        }
    });

    // Status Justification Logic
    const statusSelect = document.getElementById('status');
    const invalidJustificationGroup = document.getElementById('invalidJustificationGroup');
    const invalidJustification = document.getElementById('invalidJustification');

    if (statusSelect && invalidJustificationGroup) {
        statusSelect.addEventListener('change', (e) => {
            if (e.target.value === 'invalid') {
                invalidJustificationGroup.style.display = 'block';
                invalidJustification.required = true;
            } else {
                invalidJustificationGroup.style.display = 'none';
                invalidJustification.required = false;
            }
        });
    }

    // Evidence Logic
    const evidenceInput = document.getElementById('actionPlanEvidence');
    const clearEvidenceBtn = document.getElementById('clearEvidenceBtn');

    if (evidenceInput) {
        evidenceInput.addEventListener('change', () => {
            if (evidenceInput.files.length > 0) {
                clearEvidenceBtn.style.display = 'block';
            } else {
                clearEvidenceBtn.style.display = 'none';
            }
        });
    }

    if (clearEvidenceBtn) {
        clearEvidenceBtn.addEventListener('click', () => {
            evidenceInput.value = '';
            clearEvidenceBtn.style.display = 'none';
            evidenceInput.setAttribute('data-cleared', 'true');
        });
    }

    const cancelEditBtn = document.getElementById('cancelEditBtn');
    if (cancelEditBtn) {
        cancelEditBtn.addEventListener('click', () => {
            editingComplaintId = null;
            form.reset();
            evidenceInput.removeAttribute('data-cleared');
            if (clearEvidenceBtn) clearEvidenceBtn.style.display = 'none';
            if (invalidJustificationGroup) invalidJustificationGroup.style.display = 'none';
            
            const categoryOtherInput = document.getElementById('category_other');
            if (categoryOtherInput) categoryOtherInput.style.display = 'none';
            
            const formHeader = document.querySelector('.form-header h2');
            if (formHeader) formHeader.textContent = 'Registrar Reclamação';
            
            const submitText = document.querySelector('.btn-submit span');
            if (submitText) submitText.textContent = 'Registrar Ocorrência';
            
            cancelEditBtn.style.display = 'none';
        });
    }

    // --- State Management (Firebase) ---
    let complaints = [];
    let currentFilteredComplaints = [];
    let editingComplaintId = null;

    db.collection("complaints").orderBy("createdAt", "desc").onSnapshot((snapshot) => {
        complaints = [];
        snapshot.forEach((doc) => {
            complaints.push(doc.data());
        });
        updateDashboard();
    }, (error) => {
        console.error("Erro ao buscar dados do Firebase:", error);
        alert("Erro de conexão com o banco de dados. Atualize a página.");
    });

    // Helper: Generate sequential ID (SL-01, SL-02...)
    function generateSequentialId() {
        let maxId = 0;
        complaints.forEach(c => {
            const match = c.id.match(/^SL-(\d+)$/);
            if (match) {
                const num = parseInt(match[1], 10);
                if (num > maxId) maxId = num;
            }
        });
        return 'SL-' + (maxId + 1).toString().padStart(2, '0');
    }

    function getBusinessDaysElapsed(startDateStr) {
        if (!startDateStr) return 0;
        let startDate = new Date(startDateStr);
        let endDate = new Date(); // Today
        
        // Reset time to ignore hours
        startDate.setHours(0,0,0,0);
        endDate.setHours(0,0,0,0);
        
        let count = 0;
        let curDate = new Date(startDate);
        
        while (curDate < endDate) {
            curDate.setDate(curDate.getDate() + 1);
            const dayOfWeek = curDate.getDay();
            if (dayOfWeek !== 0 && dayOfWeek !== 6) { // 0 is Sunday, 6 is Saturday
                count++;
            }
        }
        return count;
    }

    function checkLateStatus() {
        const statusVal = document.getElementById('status') ? document.getElementById('status').value : '';
        const dateVal = document.getElementById('date') ? document.getElementById('date').value : '';
        const lateGroup = document.getElementById('lateJustificationGroup');
        const lateInput = document.getElementById('lateJustification');
        
        if (!dateVal || !lateGroup || !lateInput) return;
        
        const isLate = (statusVal === 'open' || statusVal === 'in_progress') && getBusinessDaysElapsed(dateVal) > 10;
        
        if (isLate) {
            lateGroup.style.display = 'block';
            lateInput.required = true;
        } else {
            lateGroup.style.display = 'none';
            lateInput.required = false;
        }
    }

    const dateInputEl = document.getElementById('date');
    if (statusSelect && dateInputEl) {
        statusSelect.addEventListener('change', checkLateStatus);
        dateInputEl.addEventListener('change', checkLateStatus);
    }

    // --- Navigation Logic ---
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('data-target');
            
            // Update Active Link
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            
            // Update View
            views.forEach(view => {
                if (view.id === targetId) {
                    view.classList.remove('hidden');
                    view.classList.add('active');
                } else {
                    view.classList.remove('active');
                    view.classList.add('hidden');
                }
            });

            // Refresh Dashboard if we navigate to it
            if (targetId === 'dashboardView') {
                updateDashboard();
            }
        });
    });

    // --- Form Logic ---
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Collect data
        const formData = new FormData(form);
        
        const complaintData = {
            date: formData.get('date'),
            branch: formData.get('branch'),
            unidade: formData.get('unidade'),
            manager: formData.get('manager'),
            name: formData.get('name'),
            category: formData.get('category') === 'OUTROS' ? formData.get('category_other') : formData.get('category'),
            origin: formData.get('origin'),
            description: formData.get('description'),
            status: formData.get('status'),
            invalidJustification: formData.get('status') === 'invalid' ? formData.get('invalidJustification') : null,
            lateJustification: formData.get('lateJustification'),
            completionDate: formData.get('completionDate'),
            rootCause: formData.get('rootCause'),
            actionPlanAction: formData.get('actionPlanAction'),
            actionPlanResponsible: formData.get('actionPlanResponsible'),
            actionPlanDeadline: formData.get('actionPlanDeadline'),
            actionPlanEfficacy: formData.get('actionPlanEfficacy'),
            actionPlanEvidence: null
        };

        try {
            const fileInput = document.getElementById('actionPlanEvidence');
            const file = fileInput.files[0];
            
            const getBase64 = (file) => new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.readAsDataURL(file);
                reader.onload = () => resolve(reader.result);
                reader.onerror = error => reject(error);
            });
            
            if (file) {
                if (file.size > 700 * 1024) {
                    alert('Para salvar na nuvem sem lentidão, o arquivo anexo deve ter no máximo 700KB.');
                    return;
                }
                complaintData.actionPlanEvidence = await getBase64(file);
            } else if (editingComplaintId) {
                const isCleared = fileInput.getAttribute('data-cleared') === 'true';
                if (!isCleared) {
                    const existing = complaints.find(c => c.id === editingComplaintId);
                    complaintData.actionPlanEvidence = existing ? existing.actionPlanEvidence : null;
                }
            }

            // UI Feedback
            const btnSubmit = form.querySelector('.btn-submit');
            const originalText = btnSubmit.innerHTML;
            btnSubmit.innerHTML = '<span>Salvando na Nuvem...</span>';
            btnSubmit.disabled = true;

            setTimeout(async () => {
                if (editingComplaintId) {
                    const index = complaints.findIndex(c => c.id === editingComplaintId);
                    if (index !== -1) {
                        complaintData.id = editingComplaintId;
                        complaintData.createdAt = complaints[index].createdAt;
                        
                        await db.collection("complaints").doc(editingComplaintId).set(complaintData);
                    }
                    editingComplaintId = null;
                    if (cancelEditBtn) cancelEditBtn.style.display = 'none';
                    
                    const formHeader = document.querySelector('.form-header h2');
                    if (formHeader) formHeader.textContent = 'Registrar Reclamação';
                    
                    const submitText = document.querySelector('.btn-submit span');
                    if (submitText) submitText.textContent = 'Registrar Ocorrência';
                } else {
                    complaintData.id = generateSequentialId();
                    complaintData.createdAt = new Date().toISOString();
                    
                    await db.collection("complaints").doc(complaintData.id).set(complaintData);
                }

                // Restore button state
                btnSubmit.innerHTML = originalText;
                btnSubmit.disabled = false;

                // Show modal & Reset form
                modal.classList.add('active');
                form.reset();
                fileInput.removeAttribute('data-cleared');
                if (clearEvidenceBtn) clearEvidenceBtn.style.display = 'none';
                if (invalidJustificationGroup) invalidJustificationGroup.style.display = 'none';
                const lateJustGroup = document.getElementById('lateJustificationGroup');
                if (lateJustGroup) lateJustGroup.style.display = 'none';
                
            }, 600);
        } catch (err) {
            console.error(err);
            alert('Erro ao salvar na nuvem. Verifique sua conexão e tente novamente.');
        }
    });

    window.editComplaint = function(id) {
        const c = complaints.find(comp => comp.id === id);
        if (!c) return;

        editingComplaintId = id;
        
        // Fill the form
        document.getElementById('branch').value = c.branch || '';
        document.getElementById('unidade').value = c.unidade || '';
        document.getElementById('manager').value = c.manager || '';
        document.getElementById('date').value = c.date || '';
        document.getElementById('name').value = c.name || '';
        
        const catSelect = document.getElementById('category');
        catSelect.value = c.category;
        const categoryOtherInput = document.getElementById('category_other');
        if (c.category && !Array.from(catSelect.options).some(opt => opt.value === c.category) || c.category === 'OUTROS') {
            catSelect.value = 'OUTROS';
            if (categoryOtherInput) {
                categoryOtherInput.style.display = 'block';
                categoryOtherInput.value = c.category || '';
            }
        } else {
            if (categoryOtherInput) {
                categoryOtherInput.style.display = 'none';
                categoryOtherInput.value = '';
            }
        }

        document.getElementById('origin').value = c.origin || '';
        document.getElementById('description').value = c.description || '';
        document.getElementById('status').value = c.status || 'open';
        
        const invalidJustGroup = document.getElementById('invalidJustificationGroup');
        const invalidJustInput = document.getElementById('invalidJustification');
        if (c.status === 'invalid') {
            if (invalidJustGroup) invalidJustGroup.style.display = 'block';
            if (invalidJustInput) invalidJustInput.value = c.invalidJustification || '';
        } else {
            if (invalidJustGroup) invalidJustGroup.style.display = 'none';
            if (invalidJustInput) invalidJustInput.value = '';
        }

        checkLateStatus();
        const lateJustInput = document.getElementById('lateJustification');
        if (lateJustInput) lateJustInput.value = c.lateJustification || '';

        document.getElementById('completionDate').value = c.completionDate || '';
        document.getElementById('rootCause').value = c.rootCause || '';
        document.getElementById('actionPlanAction').value = c.actionPlanAction || '';
        document.getElementById('actionPlanResponsible').value = c.actionPlanResponsible || '';
        document.getElementById('actionPlanDeadline').value = c.actionPlanDeadline || '';
        document.getElementById('actionPlanEfficacy').value = c.actionPlanEfficacy || '';
        
        const clearBtn = document.getElementById('clearEvidenceBtn');
        const evInput = document.getElementById('actionPlanEvidence');
        if (evInput) evInput.removeAttribute('data-cleared');
        if (c.actionPlanEvidence && clearBtn) {
            clearBtn.style.display = 'block';
        } else if (clearBtn) {
            clearBtn.style.display = 'none';
        }

        // Switch to form tab
        document.querySelector('.nav-links a[data-target="formView"]').click();
        
        // Change form header to indicate editing
        const formHeader = document.querySelector('.form-header h2');
        if (formHeader) formHeader.textContent = 'Editar Reclamação ' + id;
        
        const submitText = document.querySelector('.btn-submit span');
        if (submitText) submitText.textContent = 'Salvar Alterações';
        
        const cancelBtn = document.getElementById('cancelEditBtn');
        if (cancelBtn) cancelBtn.style.display = 'block';
        
        window.scrollTo(0, 0);
    };

    // --- Modal Logic ---
    closeModalBtn.addEventListener('click', () => modal.classList.remove('active'));
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.remove('active');
    });

    const detailsModal = document.getElementById('detailsModal');
    const closeDetailsBtn = document.getElementById('closeDetailsBtn');
    
    closeDetailsBtn.addEventListener('click', () => detailsModal.classList.remove('active'));
    detailsModal.addEventListener('click', (e) => {
        if (e.target === detailsModal) detailsModal.classList.remove('active');
    });

    // --- Dashboard Logic ---
    window.toggleStatus = function(id) {
        const c = complaints.find(comp => comp.id === id);
        if (!c) return;

        let newStatus = 'open';
        if (c.status === 'open') newStatus = 'in_progress';
        else if (c.status === 'in_progress') newStatus = 'closed';
        else if (c.status === 'closed') newStatus = 'open';
        else if (c.status === 'invalid') newStatus = 'open';

        db.collection("complaints").doc(id).update({
            status: newStatus
        }).catch(err => {
            console.error("Erro ao atualizar status:", err);
            alert("Erro ao atualizar status na nuvem.");
        });
    };

    window.deleteComplaint = function(id) {
        if (confirm(`Tem certeza que deseja apagar a reclamação ${id} permanentemente? Essa ação não pode ser desfeita.`)) {
            db.collection("complaints").doc(id).delete().catch(err => {
                console.error("Erro ao apagar reclamação:", err);
                alert("Erro ao apagar reclamação na nuvem.");
            });
        }
    };

    // --- Export / Import Backup (Desativados para nuvem) ---
    // Funções mantidas no código para legado, mas botões ocultos
    if (btnExport && importFile) {
        btnExport.addEventListener('click', () => {
            const dataStr = JSON.stringify(complaints, null, 2);
            const blob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `backup-ouvidoria-simas-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        });

        importFile.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = function(event) {
                try {
                    const importedData = JSON.parse(event.target.result);
                    if (Array.isArray(importedData)) {
                        if (confirm('Atenção: Importar este backup substituirá as reclamações atuais no seu navegador. Deseja continuar?')) {
                            complaints = importedData;
                            localStorage.setItem('simasComplaints', JSON.stringify(complaints));
                            updateDashboard();
                            alert('Backup importado com sucesso!');
                        }
                    } else {
                        alert('Formato de arquivo inválido. O arquivo deve conter uma lista de reclamações.');
                    }
                } catch (err) {
                    alert('Erro ao ler o arquivo. Verifique se é um arquivo JSON válido gerado pelo sistema.');
                }
                importFile.value = ''; // Reset
            };
            reader.readAsText(file);
        });
    }

    window.viewDetails = function(id) {
        const c = complaints.find(c => c.id === id);
        if (!c) return;

        document.getElementById('detailsId').textContent = c.id;
        
        const formatItem = (label, value) => `<div style="margin-bottom: 0.5rem;"><strong>${label}:</strong> <span style="color: var(--text-muted);">${value || '-'}</span></div>`;

        let statusLabelModal = 'Em Aberto';
        if (c.status === 'in_progress') statusLabelModal = 'Em Tratativa';
        else if (c.status === 'closed') statusLabelModal = 'Fechada';
        else if (c.status === 'invalid') statusLabelModal = 'Não Procede';

        let evidenceHtml = '';
        if (c.evidence) {
            if (c.evidenceType && c.evidenceType.startsWith('image/')) {
                evidenceHtml = `<div style="margin-top: 1rem; margin-bottom: 0.5rem;"><strong>Evidência:</strong></div><div><img src="${c.evidence}" alt="Evidência Anexada" style="max-width: 100%; max-height: 300px; border-radius: 8px; border: 1px solid var(--border-color); object-fit: contain;"></div>`;
            } else {
                evidenceHtml = `<div style="margin-top: 1rem; margin-bottom: 0.5rem;"><strong>Evidência:</strong> <a href="${c.evidence}" download="${c.evidenceName}" style="color: var(--primary); text-decoration: underline;">Baixar arquivo anexo (${c.evidenceName})</a></div>`;
            }
        }

        document.getElementById('detailsContent').innerHTML = `
            ${formatItem('Status', statusLabelModal)}
            ${formatItem('Data da Reclamação', c.date ? new Date(c.date + 'T00:00:00').toLocaleDateString('pt-BR') : '-')}
            ${formatItem('Filial', c.branch)}
            ${formatItem('Unidade', c.unidade)}
            ${formatItem('Gestor', c.manager)}
            ${formatItem('Cliente', c.name)}
            <hr style="border:0; border-top:1px solid var(--border-color); margin: 0.5rem 0;">
            ${formatItem('Categoria', c.category)}
            ${formatItem('Origem', c.origin)}
            <div style="margin-bottom: 0.5rem;"><strong>Detalhes da Reclamação:</strong></div>
            <div style="background: var(--bg-base); padding: 1rem; border-radius: 8px; color: var(--text-muted); margin-bottom: 1rem; white-space: pre-wrap;">${c.description}</div>
            
            <h4 style="color: var(--text-main); margin-bottom: 0.5rem;">Tratativa</h4>
            ${c.status === 'invalid' && c.invalidJustification ? `
            <div style="margin-bottom: 0.5rem;"><strong>Justificativa (Não Procede):</strong></div>
            <div style="background: var(--bg-base); padding: 1rem; border-radius: 8px; color: var(--text-muted); margin-bottom: 1rem; white-space: pre-wrap;">${c.invalidJustification}</div>
            ` : ''}
            ${c.lateJustification ? `
            <div style="margin-bottom: 0.5rem;"><strong style="color: var(--error);">Justificativa de Atraso:</strong></div>
            <div style="background: rgba(239, 68, 68, 0.05); border: 1px solid var(--error); padding: 1rem; border-radius: 8px; color: var(--text-muted); margin-bottom: 1rem; white-space: pre-wrap;">${c.lateJustification}</div>
            ` : ''}
            ${formatItem('Data da Conclusão', c.completionDate ? new Date(c.completionDate + 'T00:00:00').toLocaleDateString('pt-BR') : '-')}
            <div style="margin-bottom: 0.5rem;"><strong>Causa Raiz:</strong></div>
            <div style="background: var(--bg-base); padding: 1rem; border-radius: 8px; color: var(--text-muted); margin-bottom: 1rem; white-space: pre-wrap;">${c.rootCause || '-'}</div>
            
            <h4 style="color: var(--text-main); margin-bottom: 0.5rem; margin-top: 1rem;">Plano de Ação</h4>
            <div style="background: var(--bg-base); padding: 1rem; border-radius: 8px; color: var(--text-muted); margin-bottom: 1rem;">
                ${formatItem('Ação (O que?)', c.actionPlanAction)}
                ${formatItem('Responsável', c.actionPlanResponsible)}
                ${formatItem('Prazo', c.actionPlanDeadline ? new Date(c.actionPlanDeadline + 'T00:00:00').toLocaleDateString('pt-BR') : '-')}
                ${formatItem('Eficácia', c.actionPlanEfficacy)}
                ${evidenceHtml}
            </div>
        `;

        detailsModal.classList.add('active');
    };

    const filterBranch = document.getElementById('filterBranch');
    const filterUnidade = document.getElementById('filterUnidade');
    const filterStatus = document.getElementById('filterStatus');

    if (filterBranch && filterStatus) {
        filterBranch.addEventListener('change', updateDashboard);
        filterStatus.addEventListener('change', updateDashboard);
    }
    if (filterUnidade) {
        filterUnidade.addEventListener('change', updateDashboard);
    }

    function updateDashboard() {
        // Popula filtro Unidade de forma dinâmica
        if (filterUnidade) {
            const currentValue = filterUnidade.value;
            filterUnidade.innerHTML = '<option value="all">Todas as Unidades</option>';
            const unidadesSet = new Set();
            let hasEmptyUnidade = false;
            
            complaints.forEach(c => {
                if (c.unidade && c.unidade.trim() !== '') {
                    unidadesSet.add(c.unidade.trim());
                } else {
                    hasEmptyUnidade = true;
                }
            });
            
            const unidades = Array.from(unidadesSet).sort();
            unidades.forEach(u => {
                const opt = document.createElement('option');
                opt.value = u;
                opt.textContent = u;
                filterUnidade.appendChild(opt);
            });
            
            if (hasEmptyUnidade) {
                const opt = document.createElement('option');
                opt.value = 'Unidade não informada';
                opt.textContent = 'Unidade não informada';
                filterUnidade.appendChild(opt);
            }
            
            if (currentValue && currentValue !== 'all' && (unidades.includes(currentValue) || (currentValue === 'Unidade não informada' && hasEmptyUnidade))) {
                filterUnidade.value = currentValue;
            } else {
                filterUnidade.value = 'all';
            }
        }

        // Apply filters
        let filteredComplaints = complaints;
        if (filterBranch && filterBranch.value !== 'all') {
            filteredComplaints = filteredComplaints.filter(c => c.branch === filterBranch.value);
        }
        if (filterUnidade && filterUnidade.value !== 'all') {
            filteredComplaints = filteredComplaints.filter(c => {
                const u = c.unidade ? c.unidade.trim() : '';
                if (filterUnidade.value === 'Unidade não informada') {
                    return u === '';
                }
                return u === filterUnidade.value;
            });
        }
        if (filterStatus && filterStatus.value !== 'all') {
            filteredComplaints = filteredComplaints.filter(c => c.status === filterStatus.value);
        }

        // Update KPIs (Dinâmicos)
        const total = filteredComplaints.length;
        const open = filteredComplaints.filter(c => c.status === 'open').length;
        const inProgress = filteredComplaints.filter(c => c.status === 'in_progress').length;
        const closed = filteredComplaints.filter(c => c.status === 'closed').length;
        const invalid = filteredComplaints.filter(c => c.status === 'invalid').length;

        const kpiTotal = document.getElementById('kpi-total');
        const kpiOpen = document.getElementById('kpi-open');
        const kpiProgress = document.getElementById('kpi-progress');
        const kpiClosed = document.getElementById('kpi-closed');
        const kpiInvalid = document.getElementById('kpi-invalid');

        if (kpiTotal) kpiTotal.textContent = total;
        if (kpiOpen) kpiOpen.textContent = open;
        if (kpiProgress) kpiProgress.textContent = inProgress;
        if (kpiClosed) kpiClosed.textContent = closed;
        if (kpiInvalid) kpiInvalid.textContent = invalid;

        currentFilteredComplaints = filteredComplaints;

        tableBody.innerHTML = '';

        if (filteredComplaints.length === 0) {
            emptyState.style.display = 'block';
            document.querySelector('.complaints-table').style.display = 'none';
        } else {
            emptyState.style.display = 'none';
            document.querySelector('.complaints-table').style.display = 'table';

            filteredComplaints.forEach(c => {
                let statusLabel = 'Em Aberto';
                let statusClass = 'status-open';
                let actionLabel = 'Tratar';

                if (c.status === 'in_progress') {
                    statusLabel = 'Em Tratativa';
                    statusClass = 'status-progress';
                    actionLabel = 'Fechar';
                } else if (c.status === 'closed') {
                    statusLabel = 'Fechada';
                    statusClass = 'status-closed';
                    actionLabel = 'Anular';
                } else if (c.status === 'invalid') {
                    statusLabel = 'Não Procede';
                    statusClass = 'status-invalid';
                    actionLabel = 'Reabrir';
                }

                // Business logic: check if late (more than 10 business days elapsed and not closed/invalid)
                const isLate = (c.status === 'open' || c.status === 'in_progress') && getBusinessDaysElapsed(c.date) > 10;
                
                const tr = document.createElement('tr');
                if (isLate) {
                    tr.className = 'row-late';
                }
                
                const displayUnidade = (c.unidade && c.unidade.trim() !== '') ? c.unidade : 'Unidade não informada';

                tr.innerHTML = `
                    <td><strong>${c.id}</strong></td>
                    <td>${c.date ? new Date(c.date + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}</td>
                    <td>${c.branch}</td>
                    <td>${displayUnidade}</td>
                    <td>${c.manager || '-'}</td>
                    <td>${c.name}</td>
                    <td style="text-transform: capitalize;">${c.category}</td>
                    <td>${c.origin || '-'}</td>
                    <td><span class="status-badge ${statusClass}">${statusLabel}</span></td>
                    <td>
                        <div style="display: flex; gap: 0.5rem;">
                            <button class="btn-action btn-edit" onclick="editComplaint('${c.id}')" style="background: rgba(59, 130, 246, 0.1); color: #3b82f6; border-color: rgba(59, 130, 246, 0.2);" title="Editar">✏️</button>
                            <button class="btn-action" onclick="viewDetails('${c.id}')" title="Ler Detalhes">📄</button>
                            <button class="btn-action" onclick="toggleStatus('${c.id}')">${actionLabel}</button>
                            <button class="btn-action btn-delete" onclick="deleteComplaint('${c.id}')" style="background: rgba(239, 68, 68, 0.1); color: #ef4444; border-color: rgba(239, 68, 68, 0.2);" title="Apagar">🗑️</button>
                        </div>
                    </td>
                `;
                tableBody.appendChild(tr);
            });
        }
    }

    const btnExportExcel = document.getElementById('btnExportExcel');
    if (btnExportExcel) {
        btnExportExcel.addEventListener('click', () => {
            if (typeof XLSX === 'undefined') {
                alert('Biblioteca Excel não carregada.');
                return;
            }

            const exportData = currentFilteredComplaints.map(c => {
                let statusTraduzido = c.status;
                if (c.status === 'open') statusTraduzido = 'Em Aberto';
                else if (c.status === 'in_progress') statusTraduzido = 'Em Tratativa';
                else if (c.status === 'closed') statusTraduzido = 'Fechada';
                else if (c.status === 'invalid') statusTraduzido = 'Não Procede';

                return {
                    'ID': c.id || '',
                    'Data da Reclamação': c.date ? new Date(c.date + 'T00:00:00').toLocaleDateString('pt-BR') : '',
                    'Filial': c.branch || '',
                    'Unidade': c.unidade || '',
                    'Gestor Responsável': c.manager || '',
                    'Cliente': c.name || '',
                    'Categoria': c.category || '',
                    'Origem': c.origin || '',
                    'Detalhes': c.description || '',
                    'Status': statusTraduzido,
                    'Causa Raiz': c.rootCause || '',
                    'Ação do Plano': c.actionPlanAction || '',
                    'Responsável da Ação': c.actionPlanResponsible || '',
                    'Prazo da Ação': c.actionPlanDeadline ? new Date(c.actionPlanDeadline + 'T00:00:00').toLocaleDateString('pt-BR') : '',
                    'Eficácia': c.actionPlanEfficacy || '',
                    'Data de Conclusão': c.completionDate ? new Date(c.completionDate + 'T00:00:00').toLocaleDateString('pt-BR') : '',
                    'Justificativa de N/P': c.invalidJustification || '',
                    'Justificativa de Atraso': c.lateJustification || '',
                    'Evidência': c.evidenceName || (c.evidence ? 'Anexo disponível' : '')
                };
            });

            const worksheet = XLSX.utils.json_to_sheet(exportData);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Reclamações");

            const dateStr = new Date().toISOString().split('T')[0];
            const filename = `Ouvidoria_Simas_Reclamacoes_${dateStr}.xlsx`;
            XLSX.writeFile(workbook, filename);
        });
    }

    // Initialize Dashboard on load
    updateDashboard();
});
