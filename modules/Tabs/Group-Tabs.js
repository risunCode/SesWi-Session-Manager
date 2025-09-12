/**
 * Other sessions management (all sessions from different domains)
 */

import * as DataManager from '../ChromeAPI/DataManager.js';
import tabIcons from '../ChromeAPI/IconsGrabber.js';
import GlobalPagination from '../Utilities/GlobalPagination.js';
import { handleError, createSuccessResponse, Logger, escapeHtml, formatRelativeTimestamp } from '../Utilities/GlobalUtility.js';
import modalManager from './ModalManager.js';

class GroupTabs {
    constructor() {
        this.groupedSessions = [];
        this.expandedGroup = null;
        this.groupPages = {};
    }

    /**
     * Initialize other sessions
     */
    async initialize() {
        try {
            await this.loadAllSessions();
            return createSuccessResponse(null, 'Other sessions initialized');
        } catch (error) {
            return handleError(error, 'initialize');
        }
    }

    async loadAllSessions() {
        try {
            const result = await DataManager.getAllSessionsGrouped();
            if (result.success) {
                this.groupedSessions = result.data;
                const previousPages = this.groupPages || {};
                this.groupPages = {};
                result.data.forEach(group => {
                    this.groupPages[group.domain] = previousPages[group.domain] || 1;
                });
            }
            return result;
        } catch (error) {
            return handleError(error, 'loadAllSessions');
        }
    }

    toggleGroup(domain) {
        this.expandedGroup = this.expandedGroup === domain ? null : domain;
    }

    setGroupPage(domain, page) {
        this.groupPages[domain] = page;
    }

    getGroupPage(domain) {
        return this.groupPages[domain] || 1;
    }

    getGroupedSessions() {
        return this.groupedSessions;
    }

    // Pagination helpers using GlobalPagination
    getPagedSessions(domain) {
        const group = this.groupedSessions.find(g => g.domain === domain);
        if (!group) return [];
        const page = this.getGroupPage(domain);
        const isExpanded = this.expandedGroup === domain;
        
        if (isExpanded) {
            // For expanded groups, show max 4 sessions with pagination
            return GlobalPagination.getPage(group.sessions, page, 4);
        } else {
            // For collapsed groups, show normal pagination
            return GlobalPagination.getPage(group.sessions, page);
        }
    }

    getTotalPages(domain) {
        const group = this.groupedSessions.find(g => g.domain === domain);
        if (!group) return 0;
        const isExpanded = this.expandedGroup === domain;
        
        if (isExpanded) {
            // For expanded groups, use 4 items per page
            return GlobalPagination.getTotalPages(group.sessions, 4);
        } else {
            // For collapsed groups, use default pagination
            return GlobalPagination.getTotalPages(group.sessions);
        }
    }

    // Generate pagination HTML for groups
    generateGroupPaginationHTML(domain) {
        const group = this.groupedSessions.find(g => g.domain === domain);
        if (!group) return '';
        
        const currentPage = this.getGroupPage(domain);
        const isExpanded = this.expandedGroup === domain;
        
        if (isExpanded) {
            // For expanded groups, use 4 items per page and SHOW pagination if needed
            // Pass isExpanded = false so GlobalPagination renders pagination when items > 4
            return GlobalPagination.generateGroupHTML(group.sessions, currentPage, domain, 4, false);
        } else {
            // For collapsed groups, use default pagination (unlimited pages as needed)
            return GlobalPagination.generateGroupHTML(group.sessions, currentPage, domain);
        }
    }

    // Main method to render group sessions
    async renderGroupSessions() {
        const container = document.getElementById('groupSessionsContainer');
        if (!container) {
            Logger.error('Group sessions container not found');
            return;
        }

        try {
            // First load all sessions
            await this.loadAllSessions();
            
            const iconUrlMap = await tabIcons.refresh();
            const groups = this.groupedSessions;
            
            if (!groups || groups.length === 0) {
                this.renderEmptyState(container, 'Group Sessions', 'Belum ada sesi yang disimpan');
                return;
            }
            
            container.innerHTML = '';
            groups.forEach(g => container.appendChild(this.createGroupCard(g, iconUrlMap, container)));
        } catch (e) {
            Logger.error('Error refreshing group sessions:', e);
            this.renderEmptyState(container, 'Group Sessions', 'Terjadi kesalahan');
        }
    }

    // Create group card element
    createGroupCard(group, iconUrlMap, container) {
        const wrap = document.createElement('div');
        wrap.className = 'group-card';
        wrap.setAttribute('data-domain', group.domain);
        
        const header = document.createElement('div');
        header.className = 'group-header';
        header.setAttribute('data-domain', group.domain);
        
        const favicon = document.createElement('img');
        favicon.className = 'group-favicon';
        favicon.alt = '';
        favicon.src = iconUrlMap[group.domain] || '';
        
        const domainEl = document.createElement('div');
        domainEl.className = 'group-domain';
        domainEl.textContent = group.domain;
        
        const infoEl = document.createElement('div');
        infoEl.className = 'group-info';
        const totalCookies = group.sessions.reduce((sum, s) => sum + s.cookies.length, 0);
        infoEl.textContent = `${group.sessions.length} session with total ${totalCookies} Cookies`;
        
        const arrow = document.createElement('div');
        arrow.className = 'group-arrow';
        arrow.textContent = '▶';
        
        const leftWrap = document.createElement('div');
        leftWrap.className = 'group-header-left';
        leftWrap.style.display = 'flex';
        leftWrap.style.alignItems = 'center';
        leftWrap.appendChild(favicon);
        leftWrap.appendChild(domainEl);
        
        const rightWrap = document.createElement('div');
        rightWrap.className = 'group-right';
        rightWrap.style.display = 'flex';
        rightWrap.style.alignItems = 'center';
        rightWrap.style.gap = '10px';
        rightWrap.appendChild(infoEl);
        rightWrap.appendChild(arrow);
        
        header.appendChild(leftWrap);
        header.appendChild(rightWrap);
        
        const sessionsEl = document.createElement('div');
        sessionsEl.className = 'group-sessions';
        sessionsEl.style.display = 'none'; // Hidden by default, content will be rendered on expand
        
        // Add click handler using Group-Tabs logic
        header.addEventListener('click', () => {
            this.handleGroupToggle(group.domain, container);
        });
        
        // Add pagination event listeners
        sessionsEl.addEventListener('click', (e) => {
            if (e.target.classList.contains('group-page-btn')) {
                const page = parseInt(e.target.dataset.page);
                if (page && !e.target.disabled) {
                    this.handlePaginationClick(group.domain, page, container);
                }
            }
        });
        
        wrap.appendChild(header);
        wrap.appendChild(sessionsEl);
        return wrap;
    }

    // Handle group expansion with single expand logic
    handleGroupToggle(domain, container) {
        const wasExpanded = this.expandedGroup === domain;
        
        // Close all other expanded groups first
        const allGroupCards = container.querySelectorAll('.group-card');
        allGroupCards.forEach(card => {
            const cardDomain = card.getAttribute('data-domain');
            if (cardDomain !== domain) {
                card.classList.remove('expanded');
                const sessionsEl = card.querySelector('.group-sessions');
                const arrow = card.querySelector('.group-arrow');
                if (sessionsEl) sessionsEl.style.display = 'none';
                if (arrow) arrow.textContent = '▶';
            }
        });
        
        // Toggle current group
        const currentCard = container.querySelector(`[data-domain="${domain}"]`);
        if (currentCard) {
            const sessionsEl = currentCard.querySelector('.group-sessions');
            const arrow = currentCard.querySelector('.group-arrow');
            
            if (wasExpanded) {
                // Collapse
                currentCard.classList.remove('expanded');
                if (sessionsEl) sessionsEl.style.display = 'none';
                if (arrow) arrow.textContent = '▶';
                // Update state before returning
                this.expandedGroup = null;
            } else {
                // Expand
                currentCard.classList.add('expanded');
                if (sessionsEl) sessionsEl.style.display = 'block';
                if (arrow) arrow.textContent = '▼';
                
                // Move expanded group to top position
                currentCard.remove();
                container.insertBefore(currentCard, container.firstChild);
                
                // Auto-scroll to top
                container.scrollTop = 0;
                currentCard.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'start',
                    inline: 'nearest'
                });
                // Set expanded state first so pagination uses expanded settings
                this.expandedGroup = domain;
                // Reset to first page when expanding so we always show the first 4 sessions
                this.setGroupPage(domain, 1);
                // Re-render content for expanded state so page size is correct (4)
                this.refreshGroupContent(domain, container);
            }
        }
        // No further toggle here; state already set appropriately above
    }

    // Handle pagination click
    handlePaginationClick(domain, page, container) {
        this.setGroupPage(domain, page);
        // Refresh the group content
        this.refreshGroupContent(domain, container);
    }

    // Refresh group content after pagination
    refreshGroupContent(domain, container) {
        const groupCard = container.querySelector(`[data-domain="${domain}"]`);
        if (!groupCard) return;
        
        const sessionsEl = groupCard.querySelector('.group-sessions');
        
        if (sessionsEl) {
            // Update sessions content
            const pagedSessions = this.getPagedSessions(domain);
            sessionsEl.innerHTML = '';
            pagedSessions.forEach(session => {
                const sessionCard = this.createSessionCard(session, domain);
                sessionsEl.appendChild(sessionCard);
            });
            
            // Re-add pagination
            const paginationHTML = this.generateGroupPaginationHTML(domain);
            if (paginationHTML) {
                sessionsEl.insertAdjacentHTML('beforeend', paginationHTML);
            }
        }
    }

    // Create session card element
    createSessionCard(session, domain) {
        const sessionCard = document.createElement('div');
        sessionCard.className = 'session-card';
        sessionCard.setAttribute('data-ts', session.timestamp);
        
        sessionCard.innerHTML = `
            <div class="session-header">
                <span class="session-index">${session.index || 1}</span>
                <span class="session-name">${escapeHtml(session.name)}</span>
                <span class="cookie-count">🍪 ${session.cookies?.length || 0}</span>
            </div>
            <div class="session-meta">${formatRelativeTimestamp(session.timestamp)}</div>
        `;
        // Open Session Actions modal on click with group context
        sessionCard.addEventListener('click', () => {
            modalManager.openSessionActions(session, { source: 'group', domain });
        });
        
        return sessionCard;
    }

    // Render empty state
    renderEmptyState(container, title, subtitle) {
        container.innerHTML = '';
        const wrap = document.createElement('div');
        wrap.className = 'empty-state';
        wrap.innerHTML = `<div class="empty-state-text">${escapeHtml(title)}</div><div class="empty-state-subtext">${escapeHtml(subtitle)}</div>`;
        container.appendChild(wrap);
    }

    // Utility functions removed in favor of shared Utilities/Sanitize.js

    async refresh() {
        await this.loadAllSessions();
        return createSuccessResponse(null, 'Refreshed');
    }
}

// Create singleton instance
const groupTabs = new GroupTabs();
export default groupTabs;
