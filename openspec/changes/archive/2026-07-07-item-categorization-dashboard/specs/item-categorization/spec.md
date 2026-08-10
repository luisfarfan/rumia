## ADDED Requirements

### Requirement: Item Categorization
The system SHALL classify ingested items into a strict predefined category and assign free-form semantic tags based on the item's content.

#### Scenario: Categorizing a valid item
- **WHEN** the item has been successfully extracted and its text content is available
- **THEN** the CategorizationAgent analyzes the content, assigns a single category from the predefined list (e.g. News, Tutorial), and generates up to 5 semantic tags.
