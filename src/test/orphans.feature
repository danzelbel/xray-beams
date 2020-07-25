Feature: Orphans view
	As a user,
	I want to be view all orphaned scenarios
	so that I can add them to a feature

Scenario: View orphans
	When the Orphans view is expanded
	Then the scenarios are shown

Scenario: Refresh view
	When the user refreshes the view
	Then any changes in the orphans will reflect in the view

Scenario: Open file
	When the user opens an orphaned scenario
	Then an new editor opens showing only the orphaned scenario

Scenario: Add to current feature
	Given a feature file
	When the user adds an orphaned scenario
	Then the scenario gets added to the feature file