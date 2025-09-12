/**
 * Current tab session management
 */

import * as DataManager from '../ChromeAPI/DataManager.js';
import tabIcons from '../ChromeAPI/IconsGrabber.js';
import { getCurrentTabCookies } from '../ChromeAPI/CookieGrabber.js';
import { handleError, createSuccessResponse, Logger, escapeHtml, isSensitiveAuthDomain, getSensitiveDomainWarning, formatRelativeTimestamp } from '../Utilities/GlobalUtility.js';
import globalPagination from '../Utilities/GlobalPagination.js';
import modalManager from './ModalManager.js';

class CurrentSessionTab {
    constructor() {
        this.currentTabInfo = null;
        this.currentSessions = [];
        // pagination state for current sessions
        this.currentPage = 1;
        this.itemsPerPage = 5;
    }

    /**
     * Initialize current tab
     */
    async initialize() {
        try {
            await this.loadCurrentTabInfo();
            await this.loadCurrentDomainSessions();
            // Listen for updates coming from Session Actions modal (rename/replace)
            document.addEventListener('seswi:session-updated', async (e) => {
                try {
                    const ts = e?.detail?.timestamp ? String(e.detail.timestamp) : null;
                    if (ts) this.justSavedTs = ts;
                    this.currentPage = 1;
                    await this.renderCurrentSessions();
                    if (ts) {
                        clearTimeout(this._clearHighlightTimer);
                        this._clearHighlightTimer = setTimeout(async () => {
                            this.justSavedTs = null;
                            await this.renderCurrentSessions();
                        }, 6000);
                    }
                } catch {}
            });
            document.addEventListener('seswi:session-replaced', async (e) => {
                try {
                    const ts = e?.detail?.timestamp ? String(e.detail.timestamp) : null;
                    if (ts) this.justSavedTs = ts;
                    this.currentPage = 1;
                    await this.renderCurrentSessions();
                    if (ts) {
                        clearTimeout(this._clearHighlightTimer);
                        this._clearHighlightTimer = setTimeout(async () => {
                            this.justSavedTs = null;
                            await this.renderCurrentSessions();
                        }, 6000);
                    }
                } catch {}
            });
            return createSuccessResponse(null, 'Current tab initialized');
        } catch (error) {
            return handleError(error, 'initialize');
        }
    }

    /**
     * Load current tab information
     */
    async loadCurrentTabInfo() {
        try {
            const result = await DataManager.getCurrentTabInfo();
            if (result.success) {
                this.currentTabInfo = result.data;
            }
            return result;
        } catch (error) {
            return handleError(error, 'loadCurrentTabInfo');
        }
    }

    /**
     * Load sessions for current domain
     */
    async loadCurrentDomainSessions() {
        try {
            const result = await DataManager.getCurrentDomainSessions(this.currentTabInfo?.domain);
            if (result.success) {
                this.currentSessions = result.data;
            }
            return result;
        } catch (error) {
            return handleError(error, 'loadCurrentDomainSessions');
        }
    }

    /**
     * Get current tab cookies
     */
    async getCurrentCookies() {
        try {
            return await getCurrentTabCookies();
        } catch (error) {
            return handleError(error, 'getCurrentCookies');
        }
    }

    /**
     * Save current session
     */
    async saveCurrentSession(sessionName) {
        try {
            const result = await DataManager.saveCurrentSession(sessionName);
            if (result.success) {
                await this.loadCurrentDomainSessions(); // Refresh the list
            }
            return result;
        } catch (error) {
            return handleError(error, 'saveCurrentSession');
        }
    }

    /**
     * Get current tab info
     */
    getCurrentTabInfo() {
        return this.currentTabInfo;
    }

    /**
     * Get current domain sessions
     */
    getCurrentDomainSessions() {
        return this.currentSessions;
    }

    /**
     * Refresh current tab data
     */
    async refresh() {
        try {
            await this.loadCurrentTabInfo();
            await this.loadCurrentDomainSessions();
            return createSuccessResponse(null, 'Current tab data refreshed');
        } catch (error) {
            return handleError(error, 'refresh');
        }
    }

    /**
     * Get current domain stats
     */
    async getCurrentDomainStats() {
        try {
            const cookiesResult = await this.getCurrentCookies();
            
            if (cookiesResult.success) {
                const stats = {
                    domain: this.currentTabInfo?.domain || 'unknown',
                    url: this.currentTabInfo?.url || '',
                    cookieCount: cookiesResult.data.cookies.length,
                    sessionCount: this.currentSessions.length,
                    lastSession: this.currentSessions.length > 0 ? 
                        new Date(this.currentSessions[0].timestamp).toLocaleString() : 'None'
                };
                
                return createSuccessResponse(stats);
            }
            
            return cookiesResult;
        } catch (error) {
            return handleError(error, 'getCurrentDomainStats');
        }
    }

    /**
     * Add Session Modal Management
     */
    initializeAddSessionModal() {
        const addSessionBtn = document.getElementById('addSession');
        const sessionModal = document.getElementById('sessionModal');
        const modalClose = document.getElementById('modalClose');
        const modalCancel = document.getElementById('modalCancel');
        const modalSave = document.getElementById('modalSave');
        const sessionNameInput = document.getElementById('sessionName');

        addSessionBtn?.addEventListener('click', () => this.openAddSessionModal());
        modalClose?.addEventListener('click', () => this.closeModal());
        modalCancel?.addEventListener('click', () => this.closeModal());
        modalSave?.addEventListener('click', () => this.handleSaveSession());
        
        sessionNameInput?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.handleSaveSession();
            }
        });

        sessionModal?.addEventListener('click', (e) => {
            if (e.target === sessionModal) this.closeModal();
        });

        // Guidance card removed

        // Keyboard shortcuts   
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'n') {
                e.preventDefault();
                this.openAddSessionModal();
            }
            if (e.key === 'Escape' && sessionModal?.style.display === 'block') {
                this.closeModal();
            }
        });
    }

    async openAddSessionModal() {
        try {
            const sessionModal = document.getElementById('sessionModal');
            const modalDomain = document.getElementById('modalDomain');
            const modalCookieCount = document.getElementById('modalCookieCount');
            const sessionNameInput = document.getElementById('sessionName');
            const modalMessage = document.getElementById('modalMessage');
            const modalFavicon = document.getElementById('modalFavicon');
            // Domain notice alert elements
            const domainInfoAlert = document.getElementById('domainInfoAlert');
            const domainInfoText = document.getElementById('domainInfoText');
            const clearAfterSave = document.getElementById('clearAfterSave');

            await this.loadCurrentTabInfo();
            const cookiesInfo = await this.getCurrentCookies();
            const cookieCount = cookiesInfo.success ? cookiesInfo.data.cookies.length : 0;

            const domain = this.currentTabInfo?.domain || 'Unknown';
            modalDomain.textContent = domain;
            modalCookieCount.textContent = cookieCount;
            sessionNameInput.value = '';
            modalMessage.textContent = '';
            modalMessage.className = 'modal-message';
            modalMessage.style.display = 'none'; // hide by default until triggered

            // Show domain warning only for sensitive providers using utility helper
            try {
                const isSensitive = isSensitiveAuthDomain(domain);
                if (domainInfoAlert) domainInfoAlert.style.display = isSensitive ? 'block' : 'none';
                if (isSensitive && domainInfoText) domainInfoText.textContent = getSensitiveDomainWarning(domain);
            } catch (_) {}

            // Ensure clear-after-save is NOT auto-checked (always default to unchecked)
            if (clearAfterSave) clearAfterSave.checked = false;

            // Set favicon icon on the left of the input
            try {
                if (modalFavicon) {
                    let iconUrl = await tabIcons.getDomainIcon(domain);
                    if (!iconUrl) {
                        const baseUrl = this.currentTabInfo?.url || (domain && domain !== 'Unknown' ? `https://${domain}` : '');
                        if (baseUrl) iconUrl = `chrome://favicon/size/32@1x/${baseUrl}`;
                    }
                    if (iconUrl) {
                        modalFavicon.src = iconUrl;
                        modalFavicon.style.display = 'block';
                    } else {
                        modalFavicon.style.display = 'none';
                    }
                }
            } catch (_) {}

            sessionModal.style.display = 'block';
            sessionNameInput.focus();

        } catch (error) {
            Logger.error('Error opening modal:', error);
            this.showNotification('Error opening add session dialog', 'error');
        }
    }

    closeModal() {
        const sessionModal = document.getElementById('sessionModal');
        sessionModal.style.display = 'none';
    }

    async handleSaveSession() {
        const sessionNameInput = document.getElementById('sessionName');
        const sessionName = sessionNameInput.value.trim();
        const clearAfterSave = document.getElementById('clearAfterSave');
        
        if (!sessionName) {
            this.showModalMessage('Please enter a session name', 'error');
            return;
        }

        try {
            this.showModalMessage('Saving session...', 'info');
            const result = await this.saveCurrentSession(sessionName);
            
            if (result.success) {
                this.showModalMessage('Session saved successfully!', 'success');
                // Highlight the newly saved item for 3 seconds
                if (result?.data?.timestamp) {
                    this.justSavedTs = String(result.data.timestamp);
                    // Make sure newest page is shown and render to reflect the new item immediately
                    this.currentPage = 1;
                    await this.renderCurrentSessions();
                    // Clear highlight after 3s
                    clearTimeout(this._clearHighlightTimer);
                    this._clearHighlightTimer = setTimeout(async () => {
                        this.justSavedTs = null;
                        await this.renderCurrentSessions();
                    }, 3000);
                }
                // If user opted to clear data after saving, perform clean now (no extra confirm) and reload
                if (clearAfterSave && clearAfterSave.checked) {
                    try {
                        // Close modal before clearing/reloading to avoid lingering UI
                        this.closeModal();
                        // Ensure UI already shows the newly saved item before reload
                        // Then proceed to clean and reload the active tab
                        await DataManager.cleanCurrentTabData();
                        return; // cleaning will reload the page
                    } catch (e) {
                        Logger.error('Auto-clean after save failed:', e);
                    }
                }
                // Default path: close after brief success message and refresh lists
                setTimeout(async () => {
                    this.closeModal();
                    // Trigger refresh event
                    window.dispatchEvent(new CustomEvent('sessionSaved'));
                    // Also refresh this tab's content
                    this.currentPage = 1; // show newest on first page
                    await this.renderCurrentSessions();
                }, 1000);
            } else {
                this.showModalMessage(result.error || 'Failed to save session', 'error');
            }
        } catch (error) {
            Logger.error('Error saving session:', error);
            this.showModalMessage('Error saving session: ' + error.message, 'error');
        }
    }

    showModalMessage(message, type = 'info') {
        const modalMessage = document.getElementById('modalMessage');
        const text = message || '';
        modalMessage.textContent = text;
        modalMessage.className = `modal-message${type ? ' ' + type : ''}`;
        modalMessage.style.display = text ? 'block' : 'none';
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type} show`;
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 3000);
    }


    async updateCurrentDomain() {
        try {
            await this.loadCurrentTabInfo();
            const currentDomainEl = document.getElementById('currentDomain');
            if (currentDomainEl && this.currentTabInfo) {
                currentDomainEl.textContent = this.currentTabInfo.domain || 'Unknown';
            }
        } catch (error) {
            Logger.error('Error updating current domain:', error);
        }
    }

    /**
     * Render current sessions in the container
     */
    async renderCurrentSessions() {
        const currentContainer = document.getElementById('currentSessionsContainer');
        if (!currentContainer) {
            Logger.error('Current sessions container not found');
            return;
        }

        try {
            // Get current domain first
            const tabInfo = await DataManager.getCurrentTabInfo();
            if (!tabInfo.success) {
                throw new Error('Could not get current tab info');
            }
            
            const sessions = await DataManager.getCurrentDomainSessions(tabInfo.data.domain);
            if (!sessions.success) {
                throw new Error(sessions.error);
            }

            const sessionsData = sessions.data || [];
            Logger.log('Current sessions data:', sessionsData);

            if (sessionsData.length === 0) {
                currentContainer.innerHTML = `
                    <div class="empty-state">
                        <p>No current sessions found</p>
                    </div>
                `;
                return;
            }

            // Pagination via GlobalPagination
            globalPagination.setData(sessionsData.length, this.currentPage, this.itemsPerPage);
            const totalPages = globalPagination.getCurrentTotalPages() || 1;
            if (this.currentPage > totalPages) this.currentPage = totalPages;
            if (this.currentPage < 1) this.currentPage = 1;
            // re-sync after bounds correction
            globalPagination.setData(sessionsData.length, this.currentPage, this.itemsPerPage);
            const { startIndex, endIndex } = globalPagination.getCurrentPaginationIndices();
            const pageItems = sessionsData.slice(startIndex, endIndex);

            // Add proper CSS class to container and render current page sessions
            currentContainer.className = 'current-sessions';
            const cardsHtml = pageItems.map((session, i) => {
                const justSavedClass = (this.justSavedTs && String(session.timestamp) === String(this.justSavedTs)) ? ' just-saved' : '';
                const savedAtText = formatRelativeTimestamp(session.timestamp);
                return `
                <div class="session-card${justSavedClass}" data-ts="${session.timestamp}" data-di="${startIndex + i + 1}">
                    <div class="session-header">
                        <span class="session-index">${startIndex + i + 1}</span>
                        <span class="session-name">${escapeHtml(session.name || 'Untitled Session')}</span>
                        <span class="cookie-count">🍪 ${session.cookies?.length || 0}</span>
                    </div>
                    <div class="session-meta">${savedAtText}</div>
                </div>
            `;
            }).join('');

            const paginationHtml = globalPagination.generateCurrentHTML();

            currentContainer.innerHTML = cardsHtml + paginationHtml;

            // If we have a just-saved card visible, ensure it is scrolled into view
            if (this.justSavedTs) {
                const el = currentContainer.querySelector(`.session-card[data-ts="${this.justSavedTs}"]`);
                if (el && typeof el.scrollIntoView === 'function') {
                    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
            }

            // Wire card click -> Session Actions modal (Current context)
            const cardEls = currentContainer.querySelectorAll('.session-card');
            cardEls.forEach(card => {
                card.addEventListener('click', () => {
                    const ts = card.getAttribute('data-ts');
                    const displayIndex = Number(card.getAttribute('data-di')) || null;
                    const session = sessionsData.find(s => String(s.timestamp) === String(ts));
                    if (session) {
                        modalManager.openSessionActions(session, { source: 'current', displayIndex });
                    }
                });
            });

            // Wire up pagination via GlobalPagination
            globalPagination.setOnPageChange((page) => {
                this.currentPage = page;
                this.renderCurrentSessions();
            });
            globalPagination.attachCurrentEventListeners(currentContainer);


        } catch (error) {
            Logger.error('Error loading current sessions:', error);
            // Build error block safely without injecting error.message via innerHTML
            currentContainer.textContent = '';
            const errWrap = document.createElement('div');
            errWrap.className = 'error-state';
            const p = document.createElement('p');
            p.textContent = `Error loading sessions: ${error?.message || 'Unknown error'}`;
            const btn = document.createElement('button');
            btn.textContent = 'Retry';
            btn.addEventListener('click', () => this.renderCurrentSessions());
            errWrap.appendChild(p);
            errWrap.appendChild(btn);
            currentContainer.appendChild(errWrap);
        }
    }

}

// Create singleton instance
const currentSessionTab = new CurrentSessionTab();
export default currentSessionTab;
