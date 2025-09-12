import { initialize, getCurrentTabInfo, getCurrentTabCookies, saveCurrentSession, getCurrentDomainSessions } from './modules/ChromeAPI/DataManager.js';
import tabIcons from './modules/ChromeAPI/IconsGrabber.js';
import groupTabs from './modules/Tabs/Group-Tabs.js';
import manageTab from './modules/Tabs/Manage-Tab.js';
import currentSessionTab from './modules/Tabs/Current-Tab.js';

document.addEventListener('DOMContentLoaded', async () => {
	// Initialize DataManager first
	await initialize();

	// Tabs behavior
	const tabButtons = Array.from(document.querySelectorAll('.tab-btn'));
	const tabs = Array.from(document.querySelectorAll('.tab-content'));
	
	function activateTab(tabId) {
		tabButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tabId));
		tabs.forEach(el => el.classList.toggle('active', el.id === tabId));
		
		// Load content based on active tab
		if (tabId === 'current-session') {
			currentSessionTab.renderCurrentSessions();
		} else if (tabId === 'group-sessions') {
			groupTabs.renderGroupSessions();
		} else if (tabId === 'manage') {
			// Manage tab is already initialized
		}
	}

	tabButtons.forEach(btn => {
		btn.addEventListener('click', () => activateTab(btn.dataset.tab));
	});

	// Expose singletons for inline handlers
	window.currentSessionTab = currentSessionTab;
	window.groupTabs = groupTabs;

	// Initialize tabs
	await groupTabs.initialize();
	await manageTab.initialize();
	await currentSessionTab.initialize();
	
	// Initialize add session modal
	currentSessionTab.initializeAddSessionModal();
	
	// Update current domain display
	await currentSessionTab.updateCurrentDomain();

	// Load initial content
	await currentSessionTab.renderCurrentSessions();
	await groupTabs.renderGroupSessions();
	
	// Listen for session saved events
	function refreshAll() {
		currentSessionTab.renderCurrentSessions();
		groupTabs.renderGroupSessions();
	}
	window.addEventListener('sessionSaved', refreshAll);
	// Listen to CRUD events from Session Actions modal
	document.addEventListener('seswi:session-updated', refreshAll);
	document.addEventListener('seswi:session-deleted', refreshAll);
	document.addEventListener('seswi:session-replaced', refreshAll);

	// Listen for manual refresh requests (e.g., after restore)
	window.addEventListener('refreshCurrentSessions', () => {
		currentSessionTab.renderCurrentSessions();
	});

	// Notification system (kept for other parts of popup.js)
	function showNotification(message, type = 'info') {
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
}); 