Feature: Orphans view
    As a user,
    I want to be view all orphaned scenarios
    so that I can add them to a feature

Scenario: View orphans
    When the Orphans view is expanded
    Then the scenarios are shown

Scenario: Open file
    When the user opens a file
    Then an editor opens showing only the changes

Scenario: Add to current feature
    Given a feature file
    When the user adds the scenario
    Then the scenario gets added to the feature file