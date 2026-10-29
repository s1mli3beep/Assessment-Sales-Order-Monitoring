# Architecture and API Integration Notes

## 1. Overview

For this assessment, I built the Sales Order Monitoring application using HTML, CSS and vanilla JavaScript. I kept the implementation simple so that the page structure, styling and application logic are separated into individual files.

The application retrieves its sales order data from the mock REST API provided by Harrisons Sabah Sdn Bhd. The dashboard and order table are populated using the returned API data.

## 2. Application Structure

I divided the application into three main files:

- **`index.html`** — Defines the page structure, including the sidebar, dashboard cards, sales order table, search field, filters and pagination controls.
- **`style.css`** — Controls the visual appearance of the application, including the dashboard layout, table styling, status indicators, collapsible sidebar and responsive behaviour.
- **`app.js`** — Handles API requests, processes the returned data, updates the dashboard, renders sales order records and manages search, filtering, pagination and request states.

This document is to explain how the application communicates with the API and maps the returned data to the interface.

## 3. API Integration

I used the assessment-provided mock REST API as the application's data source.

**Base URL**

`https://hiring.harrisons.my/api/mock/sales-orders`

**Authentication**

I included the assessment-provided `x-assessment-key` header in API requests.

**Endpoints used**

| Endpoint | Purpose |
|---|---|
| `GET /api/mock/sales-orders?page=1&pageSize=25` | Retrieves a page of sales order records and summary information. |
| `GET /api/mock/sales-orders/meta` | Retrieves metadata for populating filter options. |

The API also documents an endpoint for retrieving an individual order by its sales order ID:

`GET /api/mock/sales-orders/{SalesId}`

The current interface focuses on listing and monitoring orders, so the main workflow uses the list endpoint and metadata endpoint.

I use read-only GET requests. The application does not modify the sales order data.

## 4. Data Mapping

The API response includes a `summary` object and a `data` array containing the order records. I use these fields to populate the dashboard and table.

### Dashboard

| Dashboard item | API field or calculation |
|---|---|
| Total orders | `summary.total_orders` |
| Open orders | `summary.open_orders` |
| Completed orders | `summary.invoiced_orders` + `summary.delivered_orders` |
| Cancelled orders | `summary.cancelled_orders` |
| Total order value | `summary.total_order_value` |

For the completed-orders card, I combine invoiced and delivered counts into one dashboard figure. The original categories remain separate in the API response.

### Sales Order Table

| Table column | API field |
|---|---|
| Order number | `SalesId` |
| Customer | `SalesName` |
| Branch/site | `InventSiteId` |
| Order date | `CreatedDateTime1` |
| Status | `SalesStatus` |
| Amount | `HAR_TotalSOAmount` |

I map the API fields in JavaScript before displaying the records. This makes the relationship between the API response and the interface easier to maintain.

## 5. Request and Rendering Flow

The main application flow is as follows:

1. When the page loads, JavaScript requests the API metadata and the first page of sales orders.
2. The API returns the order records, pagination details and summary information.
3. JavaScript maps the returned fields to the values used by the interface.
4. The dashboard displays the summary information, while the table displays the current page of orders.
5. When a user searches or changes a filter, the application requests the relevant results using the API's query parameters.
6. When a user changes pages, the application requests the corresponding page of records.
7. The interface displays loading, empty-result or error feedback when appropriate.

This approach allows the application to work with the provided dataset without embedding all sales order records in the frontend code.

## 6. Search, Filtering and Pagination

I implemented search and filtering to help users find relevant sales order records without manually browsing the entire dataset.

The list endpoint supports query parameters such as `q`, `site` and `status`, along with `page` and `pageSize` for pagination. The application uses these parameters when requesting filtered or paginated results.

The site and status filter options are populated using the API metadata where supported by the returned metadata structure.

## 7. Error Handling and Limitations

I included loading, empty-result and error states to make the interface clearer when requests are in progress, no records match the current criteria, or an API request fails.

Since the application calls the API directly from the browser, successful operation also depends on the API allowing cross-origin requests from the deployed website.

The assessment key is included in client-side JavaScript and can therefore be viewed by website visitors. This implementation is intended for the assessment's designated mock credential, not for confidential production credentials.

The dashboard uses the summary values returned by the API. I need to verify how these summary values behave when search and filters are applied, so that the displayed figures are interpreted correctly.

## 8. Testing Notes

My verification checklist includes:

- Comparing the dashboard figures with the API response.
- Checking that the table displays the correct order number, customer, branch/site, date, status and amount.
- Testing keyword search.
- Testing the site and status filters individually and together.
- Confirming that clearing filters restores the expected results.
- Checking pagination across multiple pages.
- Verifying the loading, empty-result and error states.
- Checking the interface on desktop and mobile screen sizes.
- Inspecting the browser console and network requests for errors.

These checks are intended to confirm that the deployed application behaves as expected against the provided API.
