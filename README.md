# Sales Order Monitoring

## Project Overview

This project is my submission for the IT Executive Assessment by Harrisons Sabah Sdn Bhd. I developed a responsive Sales Order Monitoring web application to provide a simple way to monitor sales order information, view order records and track key order statistics.

The application retrieves sales order data from the mock REST API provided for this assessment. 

- **Dashboard:** Displays total orders, open orders, completed orders, cancelled orders and total order value.
- **Sales order listing:** Displays the order number, customer name, branch/site, order date, status and order amount.
- **Search:** Allows users to search for sales order records.
- **Filtering:** Allows users to filter orders by branch/site and order status.
- **Pagination:** Allows users to navigate through the sales order records.
- **Responsive interface:** Adapts the layout for different screen sizes.
- **User feedback:** Includes loading, empty-result and error states to make the interface clearer when data is being retrieved or is unavailable.

## Technologies Used

- HTML5 for the page structure.
- CSS3 for styling and responsive layouts.
- Vanilla JavaScript for application logic and API integration.
- REST API for retrieving sales order data.
- GitHub Pages for deployment.

straightforward HTML, CSS and JavaScript implementation was chosen to keep the application lightweight and avoid unnecessary framework dependencies for this assessment.

## Project Structure

```text
sales-order-monitoring/
├── index.html
├── style.css
├── app.js
├── README.md
└── ARCHITECTURE.md
```

## How to Run the Application Locally

1. Clone or download this repository.
2. Open the project folder in a code editor. (I use VS code)
3. Right click on the `index.html` file and open with local web browser or integrated Browser
4. Check that the dashboard and sales order table load, then test the search, filters and pagination.
5. I recommend using a local web server instead of opening `index.html` directly, as browser restrictions may affect API requests from local files. But you can still try that first as it is the easiest way to access the website.

## API Integration

I used the mock REST API supplied for the assessment:

`https://hiring.harrisons.my/api/mock/sales-orders`

The application sends HTTP GET requests with the assessment-provided `x-assessment-key` header to retrieve sales order records. It also requests the metadata endpoint to obtain information used by the filtering controls.

The application uses the API response rather than a hard-coded list of sales orders. It does not create, update or delete records.

More details about the API endpoints, field mappings and application flow are provided in [ARCHITECTURE.md](ARCHITECTURE.md).

## Deployment

I deployed the application using GitHub Pages. To access the published version, please use the live application URL provided with my assessment submission.

## Testing

I briefly verified the application by checking the displayed dashboard figures against the API response, confirming the accuracy of the order table, testing search and filters, checking pagination, and verifying the loading, empty-result and error states.

I also checked the application at different screen sizes and inspect the browser console for errors. Only checks I have actually completed should be considered confirmed.

## AI Assistance

I used ChatGPT as a development aid to help me structure the application, refine the user interface and implement JavaScript functionality. I reviewed and tested the implementation as part of preparing this submission.
