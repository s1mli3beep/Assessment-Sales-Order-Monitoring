"use strict";

/* =========================================
   1. API CONFIGURATION
========================================= */

const API_BASE =
    "https://hiring.harrisons.my/api/mock/sales-orders";

const API_KEY = "hssb-assessment-mock-2026";
const PAGE_SIZE = 25;


/* =========================================
   2. HTML ELEMENT REFERENCES
========================================= */

const elements = {
    totalOrders: document.getElementById("totalOrders"),
    openOrders: document.getElementById("openOrders"),
    completedOrders: document.getElementById("completedOrders"),
    cancelledOrders: document.getElementById("cancelledOrders"),
    totalOrderValue: document.getElementById("totalOrderValue"),

    searchInput: document.getElementById("searchInput"),
    siteFilter: document.getElementById("siteFilter"),
    statusFilter: document.getElementById("statusFilter"),
    dateTypeFilter: document.getElementById("dateTypeFilter"),
    dateValueFilter: document.getElementById("dateValueFilter"),
    dateValueGroup: document.getElementById("dateValueGroup"),
    dateValueLabel: document.getElementById("dateValueLabel"),

    refreshButton: document.getElementById("refreshButton"),
    clearFilters: document.getElementById("clearFilters"),
    retryButton: document.getElementById("retryButton"),

    loadingState: document.getElementById("loadingState"),
    errorState: document.getElementById("errorState"),
    errorMessage: document.getElementById("errorMessage"),
    emptyState: document.getElementById("emptyState"),
    tableContainer: document.getElementById("tableContainer"),

    ordersTableBody: document.getElementById("ordersTableBody"),
    resultCount: document.getElementById("resultCount"),
    paginationInfo: document.getElementById("paginationInfo"),
    pageIndicator: document.getElementById("pageIndicator"),
    prevPage: document.getElementById("prevPage"),
    nextPage: document.getElementById("nextPage"),
    lastUpdated: document.getElementById("lastUpdated")
};


/* =========================================
   3. APPLICATION STATE
========================================= */

const state = {
    page: 1,
    pageSize: PAGE_SIZE,
    total: 0,
    orders: [],
    summary: null,
    metadata: null,
    loading: false,
    error: false,
    requestId: 0,
    debounceTimer: null,
    dateCacheKey: null,
    dateCacheOrders: null,
    dateCacheSummary: null
};


/* =========================================
   4. API REQUEST HELPER
========================================= */

async function apiGet(url) {
    const response = await fetch(url, {
        method: "GET",
        headers: {
            "x-assessment-key": API_KEY,
            "Accept": "application/json"
        }
    });

    if (!response.ok) {
        throw new Error(
            `API request failed with HTTP ${response.status}`
        );
    }

    return response.json();
}


/* =========================================
   5. GENERAL DATA HELPERS
========================================= */

function getField(object, names) {
    if (!object || typeof object !== "object") {
        return undefined;
    }

    for (const name of names) {
        if (
            Object.prototype.hasOwnProperty.call(object, name) &&
            object[name] !== null &&
            object[name] !== undefined
        ) {
            return object[name];
        }
    }

    const keys = Object.keys(object);

    for (const name of names) {
        const matchingKey = keys.find(
            key => key.toLowerCase() === name.toLowerCase()
        );

        if (
            matchingKey &&
            object[matchingKey] !== null &&
            object[matchingKey] !== undefined
        ) {
            return object[matchingKey];
        }
    }

    return undefined;
}


function normalizeText(value) {
    return String(value ?? "").trim();
}


function formatNumber(value) {
    const number = Number(value);

    return Number.isFinite(number)
        ? new Intl.NumberFormat("en-MY", {
            maximumFractionDigits: 0
        }).format(number)
        : "—";
}


function formatCurrency(value) {
    const number = Number(value);

    if (!Number.isFinite(number)) {
        return "—";
    }

    return new Intl.NumberFormat("en-MY", {
        style: "currency",
        currency: "MYR",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(number);
}


function formatDate(value) {
    if (!value) {
        return "—";
    }

    const raw = String(value);
    const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(raw);

    const date = dateOnly
        ? new Date(`${raw}T00:00:00`)
        : new Date(raw);

    if (Number.isNaN(date.getTime())) {
        return raw;
    }

    return new Intl.DateTimeFormat("en-MY", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    }).format(date);
}


/* =========================================
   6. NORMALIZE ORDER FIELDS
========================================= */

function normalizeOrder(order) {
    return {
        id: order.SalesId ?? "—",
        customer: order.SalesName ?? "—",
        site: order.InventSiteId ?? "—",
        date: order.CreatedDateTime1 ?? null,
        shippingDate: order.ShippingDateRequested ?? null,
        status: order.SalesStatus ?? "Unknown",
        amount: Number(order.HAR_TotalSOAmount ?? 0),
        invoicedAmount: Number(order.HAR_InvoicedAmount ?? 0),
        balanceAmount: Number(order.HAR_BalanceAmount ?? 0),
        salesTaker: order.SalesTaker ?? "—",
        customerReference: order.CustomerRef ?? "—",
        deliveryDistrict:
            order.HAR_DeliveryDistrictDescription ?? "—"
    };
}


/* =========================================
   7. LOADING AND ERROR STATES
========================================= */

function showLoading() {
    state.loading = true;
    state.error = false;

    elements.loadingState.hidden = false;
    elements.errorState.hidden = true;
    elements.emptyState.hidden = true;
    elements.tableContainer.hidden = true;

    elements.refreshButton.disabled = true;
    elements.refreshButton.textContent = "Loading...";
    elements.retryButton.disabled = true;
}


function hideLoading() {
    state.loading = false;

    elements.loadingState.hidden = true;
    elements.refreshButton.disabled = false;
    elements.refreshButton.textContent = "↻ Refresh Data";
    elements.retryButton.disabled = false;
}


function showError(error) {
    state.error = true;

    elements.loadingState.hidden = true;
    elements.tableContainer.hidden = true;
    elements.emptyState.hidden = true;
    elements.errorState.hidden = false;

    elements.errorMessage.textContent =
        error.message ||
        "An unexpected error occurred while loading the orders.";

    elements.refreshButton.disabled = false;
    elements.refreshButton.textContent = "↻ Refresh Data";
    elements.retryButton.disabled = false;
}


/* =========================================
   8. READ API RESPONSE
========================================= */

function extractOrders(response) {
    if (Array.isArray(response)) {
        return response;
    }

    const data = getField(response, [
        "data",
        "orders",
        "results",
        "items"
    ]);

    if (Array.isArray(data)) {
        return data;
    }

    throw new Error(
        "The API response does not contain an order array. " +
        "Check the response format in the browser console."
    );
}


function extractSummary(response) {
    const summary = getField(response, [
        "summary",
        "totals",
        "statistics",
        "stats"
    ]);

    return summary && typeof summary === "object"
        ? summary
        : null;
}


function extractTotal(response, summary, orders) {
    const candidates = [
        getField(response, [
            "total",
            "totalCount",
            "totalRecords",
            "totalOrders",
            "count"
        ]),
        getField(summary, [
            "totalOrders",
            "total_orders",
            "total",
            "orderCount"
        ])
    ];

    for (const candidate of candidates) {
        if (
            candidate !== undefined &&
            candidate !== null &&
            candidate !== "" &&
            Number.isFinite(Number(candidate))
        ) {
            return Number(candidate);
        }
    }

    return orders.length;
}


/* =========================================
   9. METADATA AND FILTER OPTIONS
========================================= */

function extractOptionList(metadata, names) {
    const value = getField(metadata, names);

    if (!Array.isArray(value)) {
        return [];
    }

    return value.map(item => {
        if (
            typeof item === "string" ||
            typeof item === "number"
        ) {
            return String(item);
        }

        if (item && typeof item === "object") {
            return String(
                getField(item, [
                    "value",
                    "id",
                    "code",
                    "name",
                    "label",
                    "InventSiteId",
                    "SalesStatus",
                    "Status"
                ]) ?? ""
            );
        }

        return "";
    }).filter(Boolean);
}


function populateSelect(select, values, defaultLabel) {
    const previousValue = select.value;

    select.replaceChildren();

    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.textContent = defaultLabel;
    select.appendChild(defaultOption);

    [...new Set(values)].sort().forEach(value => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = value;
        select.appendChild(option);
    });

    if (values.includes(previousValue)) {
        select.value = previousValue;
    }
}


async function loadMetadata() {
    const metadata = await apiGet(`${API_BASE}/meta`);

    state.metadata = metadata;

    const root = getField(metadata, ["data", "meta"]) || metadata;
    const facets = getField(root, ["facets"]) || root;

    const sites = extractOptionList(facets, [
        "sites",
        "branches",
        "InventSiteId",
        "inventSites"
    ]);

    const apiStatuses = extractOptionList(facets, [
        "statuses",
        "salesStatuses",
        "SalesStatus",
        "orderStatuses"
    ]);

    populateSelect(
        elements.siteFilter,
        sites,
        "All branches"
    );

    const preferredStatusOrder = [
        "Delivered",
        "Open order",
        "Invoiced",
        "Cancelled"
    ];

    const statuses = preferredStatusOrder.filter(status =>
        apiStatuses.some(value =>
            value.toLowerCase() === status.toLowerCase()
        )
    );

    apiStatuses.forEach(status => {
        if (!statuses.some(value =>
            value.toLowerCase() === status.toLowerCase()
        )) {
            statuses.push(status);
        }
    });

    populateSelect(
        elements.statusFilter,
        statuses,
        "All statuses"
    );
}


/* =========================================
   10. BUILD THE API QUERY
========================================= */

function buildOrdersUrl(page = state.page, pageSize = state.pageSize) {
    const url = new URL(API_BASE);

    url.searchParams.set("page", page);
    url.searchParams.set("pageSize", pageSize);

    const search = elements.searchInput.value.trim();
    const site = elements.siteFilter.value;
    const status = elements.statusFilter.value;

    if (search) {
        url.searchParams.set("q", search);
    }

    if (site) {
        url.searchParams.set("site", site);
    }

    if (status) {
        url.searchParams.set("status", status);
    }

    return url.toString();
}
/* =========================================
   11. DASHBOARD SUMMARY
========================================= */

function findSummaryValue(summary, candidates) {
    if (!summary) {
        return undefined;
    }

    const direct = getField(summary, candidates);

    if (direct !== undefined) {
        if (
            typeof direct === "number" ||
            typeof direct === "string"
        ) {
            return Number.isFinite(Number(direct))
                ? Number(direct)
                : undefined;
        }

        if (direct && typeof direct === "object") {
            const nestedValue = getField(direct, [
                "count",
                "total",
                "value",
                "amount"
            ]);

            if (
                nestedValue !== undefined &&
                Number.isFinite(Number(nestedValue))
            ) {
                return Number(nestedValue);
            }
        }
    }

    const groups = getField(summary, [
        "byStatus",
        "by_status",
        "statusCounts",
        "status_counts",
        "statuses"
    ]);

    if (groups && typeof groups === "object") {
        for (const [key, value] of Object.entries(groups)) {
            if (
                candidates.some(candidate =>
                    key.toLowerCase() === candidate.toLowerCase()
                )
            ) {
                const count =
                    typeof value === "object"
                        ? getField(value, ["count", "total", "value"])
                        : value;

                if (
                    count !== undefined &&
                    Number.isFinite(Number(count))
                ) {
                    return Number(count);
                }
            }
        }
    }

    return undefined;
}


function getStatusCount(summary, keywords) {
    if (!summary) {
        return undefined;
    }

    const groups = getField(summary, [
        "byStatus",
        "by_status",
        "statusCounts",
        "status_counts",
        "statuses"
    ]);

    const directCandidates = [];

    for (const keyword of keywords) {
        directCandidates.push(
            keyword,
            `${keyword}Orders`,
            `${keyword.toLowerCase()}Orders`,
            `${keyword}_count`
        );
    }

    const direct = findSummaryValue(summary, directCandidates);

    if (direct !== undefined) {
        return direct;
    }

    if (groups && typeof groups === "object") {
        let total = 0;
        let found = false;

        for (const [key, value] of Object.entries(groups)) {
            if (
                keywords.some(keyword =>
                    key.toLowerCase().includes(keyword.toLowerCase())
                )
            ) {
                const count = typeof value === "object"
                    ? getField(value, ["count", "total", "value"])
                    : value;

                if (
                    count !== undefined &&
                    Number.isFinite(Number(count))
                ) {
                    total += Number(count);
                    found = true;
                }
            }
        }

        if (found) {
            return total;
        }
    }

    return undefined;
}


function updateDashboard(summary) {
    const data = summary ?? {};

    const totalOrders = Number(data.total_orders ?? 0);
    const openOrders = Number(data.open_orders ?? 0);
    const invoicedOrders = Number(data.invoiced_orders ?? 0);
    const deliveredOrders = Number(data.delivered_orders ?? 0);
    const cancelledOrders = Number(data.cancelled_orders ?? 0);
    const totalOrderValue = Number(data.total_order_value ?? 0);

    document.getElementById("totalOrders").textContent =
        formatNumber(totalOrders);

    document.getElementById("openOrders").textContent =
        formatNumber(openOrders);

    document.getElementById("completedOrders").textContent =
        formatNumber(invoicedOrders + deliveredOrders);

    document.getElementById("cancelledOrders").textContent =
        formatNumber(cancelledOrders);

    document.getElementById("totalOrderValue").textContent =
        formatCurrency(totalOrderValue);
}


/* =========================================
   12. STATUS BADGES
========================================= */

function getStatusClass(status) {
    const value = normalizeText(status).toLowerCase();

    if (value.includes("cancel")) {
        return "status-cancelled";
    }

    if (value.includes("open")) {
        return "status-open";
    }

    if (value.includes("pending")) {
        return "status-pending";
    }

    if (value.includes("deliver")) {
        return "status-delivered";
    }

    if (value.includes("invoice")) {
        return "status-invoiced";
    }

    if (
        value.includes("complete") ||
        value.includes("closed")
    ) {
        return "status-completed";
    }

    return "status-default";
}


/* =========================================
   13. RENDER ORDER TABLE
========================================= */

function renderOrders(orders) {
    elements.ordersTableBody.replaceChildren();

    orders.forEach(rawOrder => {
        const order = normalizeOrder(rawOrder);
        const row = document.createElement("tr");

        // Use textContent rather than innerHTML to prevent
        // API-provided text from being interpreted as HTML.

        const idCell = document.createElement("td");
        idCell.className = "order-number";
        idCell.textContent = normalizeText(order.id) || "—";

        const customerCell = document.createElement("td");
        customerCell.className = "customer-name";
        customerCell.textContent =
            normalizeText(order.customer) || "—";

        const siteCell = document.createElement("td");
        siteCell.className = "site-name";
        siteCell.textContent = normalizeText(order.site) || "—";

        const dateCell = document.createElement("td");
        dateCell.textContent = formatDate(order.date);

        const statusCell = document.createElement("td");
        const badge = document.createElement("span");
        badge.className =
            `status-badge ${getStatusClass(order.status)}`;
        badge.textContent = normalizeText(order.status) || "Unknown";
        statusCell.appendChild(badge);

        const amountCell = document.createElement("td");
        amountCell.className = "amount-column";
        amountCell.textContent = formatCurrency(order.amount);

        row.append(
            idCell,
            customerCell,
            siteCell,
            dateCell,
            statusCell,
            amountCell
        );

        elements.ordersTableBody.appendChild(row);
    });
}


/* =========================================
   14. PAGINATION CONTROLS
========================================= */

function updatePagination() {
    const total = state.total;
    const page = state.page;
    const pageSize = state.pageSize;

    const start = total === 0
        ? 0
        : (page - 1) * pageSize + 1;

    const end = Math.min(page * pageSize, total);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    elements.resultCount.textContent =
        `${formatNumber(total)} orders`;

    elements.paginationInfo.textContent =
        `Showing ${formatNumber(start)}–${formatNumber(end)} of ` +
        `${formatNumber(total)} orders`;

    elements.pageIndicator.textContent =
        `Page ${page} of ${totalPages}`;

    elements.prevPage.disabled =
        state.loading || page <= 1;

    elements.nextPage.disabled =
        state.loading ||
        page >= totalPages ||
        state.orders.length === 0;
}


/* =========================================
   15. DATE FILTER HELPERS
========================================= */

// The API does not document a date query parameter.
// When a date filter is selected, fetch the matching API result set
// in batches (100 records per request), then filter by CreatedDateTime1.

function getSelectedDateFilter() {
    return {
        type: elements.dateTypeFilter?.value || "",
        value: elements.dateValueFilter?.value || ""
    };
}


function hasActiveDateFilter() {
    const filter = getSelectedDateFilter();
    return Boolean(filter.type && filter.value);
}


function getDateCacheKey() {
    return JSON.stringify({
        search: elements.searchInput.value.trim(),
        site: elements.siteFilter.value,
        status: elements.statusFilter.value,
        dateType: elements.dateTypeFilter?.value || "",
        dateValue: elements.dateValueFilter?.value || ""
    });
}


function getDateParts(value) {
    if (!value) {
        return null;
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return null;
    }

    // Use local calendar values so the filter matches the date
    // shown by formatDate() in the table.
    return {
        year: String(date.getFullYear()),
        month:
            `${date.getFullYear()}-${String(
                date.getMonth() + 1
            ).padStart(2, "0")}`,
        day:
            `${date.getFullYear()}-${String(
                date.getMonth() + 1
            ).padStart(2, "0")}-${String(
                date.getDate()
            ).padStart(2, "0")}`
    };
}


function orderMatchesDateFilter(order, filter) {
    const dateValue = order.CreatedDateTime1;

    if (!dateValue) {
        return false;
    }

    const parts = getDateParts(dateValue);

    if (!parts) {
        return false;
    }

    if (filter.type === "day") {
        return parts.day === filter.value;
    }

    if (filter.type === "month") {
        return parts.month === filter.value;
    }

    if (filter.type === "year") {
        return parts.year === filter.value;
    }

    return true;
}


function buildSummaryFromOrders(orders) {
    const summary = {
        total_orders: orders.length,
        open_orders: 0,
        invoiced_orders: 0,
        delivered_orders: 0,
        cancelled_orders: 0,
        total_order_value: 0
    };

    orders.forEach(order => {
        const status = normalizeText(order.SalesStatus).toLowerCase();

        if (
            status === "open order" ||
            status === "open" ||
            status === "pending"
        ) {
            summary.open_orders++;
        } else if (status === "invoiced") {
            summary.invoiced_orders++;
        } else if (status === "delivered") {
            summary.delivered_orders++;
        } else if (
            status === "cancelled" ||
            status === "canceled"
        ) {
            summary.cancelled_orders++;
        }

        summary.total_order_value +=
            Number(order.HAR_TotalSOAmount ?? 0);
    });

    return summary;
}


async function fetchAllOrdersForDateFilter(requestId) {
    const cacheKey = getDateCacheKey();

    if (
        state.dateCacheKey === cacheKey &&
        Array.isArray(state.dateCacheOrders) &&
        state.dateCacheSummary
    ) {
        return {
            orders: state.dateCacheOrders,
            summary: state.dateCacheSummary
        };
    }

    const batchSize = 100;
    const firstResponse = await apiGet(
        buildOrdersUrl(1, batchSize)
    );

    if (requestId !== state.requestId) {
        return null;
    }

    const firstPageOrders = extractOrders(firstResponse);

    const total = extractTotal(
        firstResponse,
        extractSummary(firstResponse),
        firstPageOrders
    );

    const totalPagesFromApi = Number(
        getField(firstResponse, ["totalPages", "total_pages"])
    );

    const totalPages =
        Number.isFinite(totalPagesFromApi) && totalPagesFromApi > 0
            ? totalPagesFromApi
            : Math.ceil(total / batchSize);

    const allOrders = [...firstPageOrders];

    for (let page = 2; page <= totalPages; page++) {
        if (requestId !== state.requestId) {
            return null;
        }

        const response = await apiGet(
            buildOrdersUrl(page, batchSize)
        );

        allOrders.push(...extractOrders(response));
    }

    const filter = getSelectedDateFilter();

    const filteredOrders = allOrders.filter(order =>
        orderMatchesDateFilter(order, filter)
    );

    const summary = buildSummaryFromOrders(filteredOrders);

    state.dateCacheKey = cacheKey;
    state.dateCacheOrders = filteredOrders;
    state.dateCacheSummary = summary;

    return {
        orders: filteredOrders,
        summary
    };
}


function updateDateFilterControl() {
    if (
        !elements.dateTypeFilter ||
        !elements.dateValueFilter ||
        !elements.dateValueGroup ||
        !elements.dateValueLabel
    ) {
        return;
    }

    const type = elements.dateTypeFilter.value;
    const input = elements.dateValueFilter;

    elements.dateValueGroup.hidden = !type;

    if (type === "day") {
        input.type = "date";
        input.step = "1";
        elements.dateValueLabel.textContent = "Select Day";

        input.setAttribute(
            "aria-label",
            "Select day to filter sales orders"
        );
    } else if (type === "month") {
        input.type = "month";
        input.removeAttribute("step");
        elements.dateValueLabel.textContent = "Select Month";

        input.setAttribute(
            "aria-label",
            "Select month to filter sales orders"
        );
    } else if (type === "year") {
        input.type = "number";
        input.min = "2000";
        input.max = "2100";
        input.step = "1";
        input.placeholder = "e.g. 2026";
        elements.dateValueLabel.textContent = "Select Year";

        input.setAttribute(
            "aria-label",
            "Enter year to filter sales orders"
        );
    } else {
        input.value = "";
    }

    // Changing the period resets the selected value to avoid
    // carrying a day/month value into a different input type.
    input.value = "";
}
/* =========================================
   15. LOAD ORDERS FROM THE API
========================================= */

async function loadOrders() {
    const requestId = ++state.requestId;
    showLoading();

    try {
        // Load filter options first, if not already loaded.
        if (!state.metadata) {
            await loadMetadata();
        }

        if (requestId !== state.requestId) {
            return;
        }

        let rawOrders;
        let summary;

        if (hasActiveDateFilter()) {
            // The API does not document a date query parameter.
            // Fetch all pages matching the other filters, then filter
            // by date locally so results are not limited to one page.
            const result = await fetchAllOrdersForDateFilter(requestId);

            if (!result || requestId !== state.requestId) {
                return;
            }

            const filteredOrders = result.orders;
            summary = result.summary;
            state.total = filteredOrders.length;

            const startIndex = (state.page - 1) * state.pageSize;

            rawOrders = filteredOrders.slice(
                startIndex,
                startIndex + state.pageSize
            );

            state.orders = rawOrders;
            state.summary = summary;
        } else {
            const response = await apiGet(buildOrdersUrl());

            if (requestId !== state.requestId) {
                return;
            }

            rawOrders = extractOrders(response);
            summary = extractSummary(response);

            state.orders = rawOrders;
            state.summary = summary;
            state.total = extractTotal(
                response,
                summary,
                rawOrders
            );
        }

        updateDashboard(summary);
        renderOrders(state.orders);
        updatePagination();

        elements.emptyState.hidden = state.orders.length !== 0;
        elements.tableContainer.hidden = state.orders.length === 0;

        elements.lastUpdated.textContent =
            `Updated ${new Date().toLocaleTimeString("en-MY", {
                hour: "2-digit",
                minute: "2-digit"
            })}`;

    } catch (error) {
        if (requestId !== state.requestId) {
            return;
        }

        console.error("Unable to load sales orders:", error);
        showError(error);

    } finally {
        if (requestId === state.requestId) {
            hideLoading();
            updatePagination();
        }
    }
}


/* =========================================
   16. SEARCH AND FILTER EVENTS
========================================= */

function applyFilters() {
    // Reset to the first page whenever filters change.
    state.page = 1;
    loadOrders();
}


elements.searchInput.addEventListener("input", () => {
    clearTimeout(state.debounceTimer);

    // Avoid sending a request for every keystroke.
    state.debounceTimer = setTimeout(() => {
        applyFilters();
    }, 350);
});


elements.siteFilter.addEventListener("change", applyFilters);
elements.statusFilter.addEventListener("change", applyFilters);


if (elements.dateTypeFilter) {
    elements.dateTypeFilter.addEventListener("change", () => {
        updateDateFilterControl();
        state.page = 1;
        loadOrders();
    });
}


if (elements.dateValueFilter) {
    elements.dateValueFilter.addEventListener("change", () => {
        state.page = 1;
        loadOrders();
    });

    elements.dateValueFilter.addEventListener("input", () => {
        // Year inputs may be edited before the user commits the value.
        if (elements.dateTypeFilter?.value === "year") {
            clearTimeout(state.debounceTimer);

            state.debounceTimer = setTimeout(() => {
                state.page = 1;
                loadOrders();
            }, 350);
        }
    });
}


/* =========================================
   17. BUTTON EVENTS
========================================= */

function clearDateFilterCache() {
    state.dateCacheKey = null;
    state.dateCacheOrders = null;
    state.dateCacheSummary = null;
}


elements.refreshButton.addEventListener("click", () => {
    clearDateFilterCache();
    loadOrders();
});


elements.retryButton.addEventListener("click", () => {
    clearDateFilterCache();
    loadOrders();
});


elements.clearFilters.addEventListener("click", () => {
    elements.searchInput.value = "";
    elements.siteFilter.value = "";
    elements.statusFilter.value = "";

    if (elements.dateTypeFilter) {
        elements.dateTypeFilter.value = "";
    }

    if (elements.dateValueFilter) {
        elements.dateValueFilter.value = "";
    }

    updateDateFilterControl();

    // Clear cached results so the next request reflects the filters.
    clearDateFilterCache();

    clearTimeout(state.debounceTimer);

    state.page = 1;
    loadOrders();
});


elements.prevPage.addEventListener("click", () => {
    if (state.page > 1 && !state.loading) {
        state.page--;
        loadOrders();
    }
});


elements.nextPage.addEventListener("click", () => {
    const totalPages = Math.ceil(state.total / state.pageSize);

    if (state.page < totalPages && !state.loading) {
        state.page++;
        loadOrders();
    }
});


/* =========================================
   18. INITIALIZE THE APPLICATION
========================================= */

// Set up the day/month/year input before the first request.
updateDateFilterControl();

// Automatically fetch the first page when the page opens.
loadOrders();


/* =========================================
   19. COLLAPSIBLE SIDEBAR
========================================= */

const sidebarToggle = document.getElementById("sidebarToggle");
const appContainer = document.querySelector(".app-container");

sidebarToggle.addEventListener("click", () => {
    const isCollapsed =
        appContainer.classList.toggle("sidebar-collapsed");

    sidebarToggle.setAttribute(
        "aria-expanded",
        String(!isCollapsed)
    );

    sidebarToggle.setAttribute(
        "aria-label",
        isCollapsed ? "Expand sidebar" : "Collapse sidebar"
    );

    sidebarToggle.setAttribute(
        "title",
        isCollapsed ? "Expand sidebar" : "Collapse sidebar"
    );
});