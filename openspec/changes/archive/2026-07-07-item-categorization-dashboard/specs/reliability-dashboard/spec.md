## ADDED Requirements

### Requirement: Expose Reliability Metrics in API
The system API SHALL expose the category, tags, and all associated claim verifications for each captured item.

#### Scenario: Fetching items from the dashboard
- **WHEN** a client requests the `/api/items` endpoint
- **THEN** the API returns the items including their assigned `category`, `tags` array, and a list of structured `claim_verifications`.

### Requirement: Render Fact-Checking Dashboard
The frontend UI SHALL display the reliability status and categorizations for captured items, and provide interactive filtering capabilities.

#### Scenario: Viewing an item with claims
- **WHEN** the user selects an item in the Next.js UI that has undergone fact-checking
- **THEN** the UI displays the `category` badge, `tags` pills, and a Sidebar section visualizing each claim as True, False, or Inconclusive with its explanation.

#### Scenario: Filtering items by category
- **WHEN** the user interacts with the category filter buttons on the dashboard
- **THEN** the UI immediately filters the visible items to show only those matching the selected category.
