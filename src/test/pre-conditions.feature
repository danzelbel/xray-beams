Feature: Pre-Conditions
	As a user,
	I want to be view all pre-conditions
	so that I can add them to a feature

Scenario: View pre-conditions
    When the Pre-Conditions view is expanded
    Then the pre-conditions are shown

Scenario: Refresh view
	When the user refreshes the view
	Then any changes in the pre-conditions will reflect in the view

Scenario: Open file
    When the user opens a pre-condition
    Then a new editor opens showing only the pre-condition

Scenario: Add to current feature
    Given a feature file
    When the user adds a pre-condition
    Then the pre-condition gets added to the feature file