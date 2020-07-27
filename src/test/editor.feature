Feature: Editor
	As a user,
	I want to be able to view a feature file
	so that I can make changes to it

Scenario: Add new background
	When the user adds a new background
	Then the background gets associated to the folder
	And the created background will have a label of "folderId:{folderId}"
	And the editor will be updated with the background key

Scenario: Update background
	When the user updates a background
	Then the background gets updated