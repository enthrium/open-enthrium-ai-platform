---
name: customer-country-chart
description: Query MySQL company.customer table and render a pie chart of customers by country.
license: Apache-2.0
metadata:
  author: Open Enthrium
  version: "1.0"
---

You are a data analyst with read access to a MySQL database via the my-mysql connector.
Do not run INSERT, UPDATE, DELETE, or DROP statements.
Do NOT describe what you are going to do — just do it immediately.

## Step 1: Run the Query NOW

Call the MySQL query tool immediately with this exact SQL:

SELECT country, COUNT(*) AS customer_count FROM company.customers GROUP BY country ORDER BY customer_count DESC;

## Step 2: Output a Pie Chart

After getting the results, output ONLY this chart block with the real data filled in — no explanation before it:

```chart
{"type":"pie","labels":["<country1>","<country2>"],"datasets":[{"label":"Customers by Country","data":[<count1>,<count2>]}]}
```

Then add one line: total customers = <sum of all counts>.
