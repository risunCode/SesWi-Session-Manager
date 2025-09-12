/**
 * GlobalPagination - unified pagination utilities for current and grouped sessions
 */

class GlobalPagination {
	constructor() {
		this.itemsPerPage = 5; // Changed from 10 to 5 for max 5 sessions per expand
		// state for current tab pagination use-cases (optional)
		this.currentPage = 1;
		this.currentItemsPerPage = 5;
		this.totalItems = 0;
		this.onPageChange = null;
	}

	// ===== Generic helpers =====
	setItemsPerPage(itemsPerPage) {
		this.itemsPerPage = Math.max(1, itemsPerPage | 0);
	}

	getPage(items, page = 1, itemsPerPage = this.itemsPerPage) {
		const safePage = Math.max(1, page | 0);
		const size = Math.max(1, itemsPerPage | 0);
		const start = (safePage - 1) * size;
		return (items || []).slice(start, start + size);
	}

	getTotalPages(items, itemsPerPage = this.itemsPerPage) {
		const size = Math.max(1, itemsPerPage | 0);
		return Math.ceil((items || []).length / size);
	}

	needsPagination(items, itemsPerPage = this.itemsPerPage) {
		const size = Math.max(1, itemsPerPage | 0);
		return (items || []).length > size;
	}

	// Group pagination HTML (stateless) - Disabled for expanded groups
	generateGroupHTML(items, currentPage, domain, itemsPerPage = this.itemsPerPage, isExpanded = false) {
		if (isExpanded || !this.needsPagination(items, itemsPerPage)) return '';
		const totalPages = this.getTotalPages(items, itemsPerPage);
		const page = Math.min(Math.max(1, currentPage | 0), Math.max(1, totalPages));
		return `
			<div class="group-pagination" data-domain="${domain}">
				<button class="group-page-btn" ${page === 1 ? 'disabled' : ''} data-page="${page - 1}">‹</button>
				${Array.from({length: totalPages}, (_, i) => i + 1).map(p => `
					<button class="group-page-btn ${p === page ? 'active' : ''}" data-page="${p}">${p}</button>
				`).join('')}
				<button class="group-page-btn" ${page === totalPages ? 'disabled' : ''} data-page="${page + 1}">›</button>
			</div>
		`;
	}

	// ===== Current tab pagination (stateful optional API) =====
	setData(totalItems, currentPage = 1, itemsPerPage = 5) {
		this.totalItems = Math.max(0, totalItems | 0);
		this.currentPage = Math.max(1, currentPage | 0);
		this.currentItemsPerPage = Math.max(1, itemsPerPage | 0);
	}

	setOnPageChange(callback) {
		this.onPageChange = typeof callback === 'function' ? callback : null;
	}

	getCurrentTotalPages() {
		return Math.ceil(this.totalItems / this.currentItemsPerPage);
	}

	isCurrentPaginationNeeded() {
		return this.totalItems > this.currentItemsPerPage;
	}

	getCurrentPaginationIndices() {
		const startIndex = (this.currentPage - 1) * this.currentItemsPerPage;
		const endIndex = startIndex + this.currentItemsPerPage;
		return { startIndex, endIndex };
	}

	generateCurrentHTML() {
		if (!this.isCurrentPaginationNeeded()) return '';
		const totalPages = this.getCurrentTotalPages();
		return `
			<div class="pagination-fixed">
				<div class="pagination-container">
					<button class="page-btn" ${this.currentPage === 1 ? 'disabled' : ''} data-page="${this.currentPage - 1}">‹</button>
					${Array.from({length: totalPages}, (_, i) => i + 1).map(p => `
						<button class="page-btn ${p === this.currentPage ? 'active' : ''}" data-page="${p}">${p}</button>
					`).join('')}
					<button class="page-btn" ${this.currentPage === totalPages ? 'disabled' : ''} data-page="${this.currentPage + 1}">›</button>
				</div>
			</div>
		`;
	}

	attachCurrentEventListeners(container) {
		if (!this.isCurrentPaginationNeeded() || !container) return;
		const pageButtons = container.querySelectorAll('.page-btn');
		pageButtons.forEach(btn => {
			btn.addEventListener('click', () => {
				const page = parseInt(btn.dataset.page);
				if (page && page !== this.currentPage && !btn.disabled) {
					this.currentPage = page;
					if (this.onPageChange) this.onPageChange(page);
				}
			});
		});
	}
}

const globalPagination = new GlobalPagination();
export default globalPagination; 